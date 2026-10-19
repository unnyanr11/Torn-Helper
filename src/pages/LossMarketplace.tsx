import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Contract { id: string; target_torn_id: number; target_name: string; price_per_loss_cents: number; quantity_total: number; quantity_reserved: number; quantity_verified: number; budget_cents: number; status: string; expires_at: string }
interface Claim { id: string; contract_id: string; quantity_claimed: number; status: string; expires_at: string }
interface Evidence { id: string; claim_id: string; attack_id: number; status: string; occurred_at: string }
interface Settlement { id: string; contract_id: string; amount_cents: number; status: string }
interface Dispute { id: string; contract_id: string; reason: string; status: string }

const TABS = ['Buy', 'Sell', 'My Contracts', 'Active Claim', 'Earnings', 'Payment Queue', 'Disputes'] as const;
type Tab = typeof TABS[number];

export default function LossMarketplace() {
  const [tab, setTab] = useState<Tab>('Buy');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [myContracts, setMyContracts] = useState<Contract[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [error, setError] = useState('');

  const [bTarget, setBTarget] = useState('');
  const [bPrice, setBPrice] = useState('');
  const [bQty, setBQty] = useState('');
  const [sContractId, setSContractId] = useState('');
  const [sQty, setSQty] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [c, mc, cl, ev, st, dp] = await Promise.all([
      supabase.from('loss_contracts').select('*').in('status', ['funded', 'active']).order('created_at', { ascending: false }),
      supabase.from('loss_contracts').select('*').eq('buyer_id', user.id).order('created_at', { ascending: false }),
      supabase.from('loss_claims').select('*').eq('seller_id', user.id).order('claimed_at', { ascending: false }),
      supabase.from('loss_evidence').select('*').eq('seller_id', user.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('settlement_entries').select('*').eq('seller_id', user.id).order('created_at', { ascending: false }),
      supabase.from('loss_disputes').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    if (c.error) setError(c.error.message); else setContracts(c.data ?? []);
    if (mc.error) setError(mc.error.message); else setMyContracts(mc.data ?? []);
    if (cl.error) setError(cl.error.message); else setClaims(cl.data ?? []);
    if (ev.error) setError(ev.error.message); else setEvidence(ev.data ?? []);
    if (st.error) setError(st.error.message); else setSettlements(st.data ?? []);
    if (dp.error) setError(dp.error.message); else setDisputes(dp.data ?? []);
  }

  async function createContract() {
    setError('');
    const price = parseInt(bPrice, 10), qty = parseInt(bQty, 10);
    if (!bTarget || isNaN(price) || isNaN(qty) || price <= 0 || qty <= 0) { setError('Enter target ID, price per loss, and quantity'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const budget = price * qty;
    const { error } = await supabase.from('loss_contracts').insert({ buyer_id: user.id, target_torn_id: parseInt(bTarget, 10), price_per_loss_cents: price, quantity_total: qty, budget_cents: budget, status: 'funded' });
    if (error) setError(error.message);
    else { setBTarget(''); setBPrice(''); setBQty(''); load(); }
  }

  async function claimSlot(c: Contract) {
    setError('');
    const qty = parseInt(sQty, 10);
    if (isNaN(qty) || qty <= 0) { setError('Enter quantity to claim'); return; }
    const remaining = c.quantity_total - c.quantity_reserved;
    if (qty > remaining) { setError(`Only ${remaining} slots remaining`); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const expires = new Date(Date.now() + 15 * 60000).toISOString();
    const { error } = await supabase.from('loss_claims').insert({ contract_id: c.id, seller_id: user.id, quantity_claimed: qty, expires_at: expires });
    if (error) setError(error.message);
    else { setSContractId(''); setSQty(''); load(); }
  }

  async function addEvidence(claimId: string) {
    setError('');
    const attackId = prompt('Attack ID from Torn:');
    if (!attackId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('loss_evidence').insert({ claim_id: claimId, attack_id: parseInt(attackId, 10), seller_id: user.id, target_torn_id: 0, occurred_at: new Date().toISOString() });
    if (error) setError(error.message);
    else load();
  }

  async function markComplete(claim: Claim) {
    await supabase.from('loss_claims').update({ status: 'completed' }).eq('id', claim.id);
    load();
  }

  async function cancelContract(c: Contract) {
    await supabase.from('loss_contracts').update({ status: 'cancelled' }).eq('id', c.id);
    load();
  }

  async function approvePayment(s: Settlement) {
    await supabase.from('settlement_entries').update({ status: 'approved' }).eq('id', s.id);
    load();
  }

  async function markPaid(s: Settlement) {
    await supabase.from('settlement_entries').update({ status: 'paid' }).eq('id', s.id);
    load();
  }

  async function raiseDispute(contractId: string) {
    const reason = prompt('Dispute reason:');
    if (!reason) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('loss_disputes').insert({ contract_id: contractId, raised_by: user.id, reason });
    if (error) setError(error.message);
    else load();
  }

  const activeClaim = claims.find((c) => c.status === 'active');
  const totalEarned = settlements.filter((s) => s.status !== 'refunded').reduce((sum, s) => sum + s.amount_cents, 0);
  const pendingPayment = settlements.filter((s) => s.status === 'earned' || s.status === 'approved').reduce((sum, s) => sum + s.amount_cents, 0);

  return (
    <section>
      <h2>Loss Marketplace</h2>
      <p className="muted">Buy and sell verified losses on Torn targets. Contracts are direct-payment (no operator custody). Claims expire after 15 minutes; evidence is deduplicated by attack ID.</p>
      {error && <p className="badge warn">{error}</p>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {TABS.map((t) => <button key={t} className={`nu-btn ${t === tab ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === 'Buy' && (
        <article className="card nu-inset">
          <h3>Create buy contract</h3>
          <input className="nu-input" placeholder="Target Torn ID" value={bTarget} onChange={(e) => setBTarget(e.target.value)} />
          <input className="nu-input" placeholder="Price per loss (cents)" type="number" value={bPrice} onChange={(e) => setBPrice(e.target.value)} />
          <input className="nu-input" placeholder="Quantity of losses" type="number" value={bQty} onChange={(e) => setBQty(e.target.value)} />
          <p className="muted">Total budget: ${bPrice && bQty ? ((parseInt(bPrice, 10) * parseInt(bQty, 10)) / 100).toFixed(2) : '0.00'}</p>
          <button className="nu-btn" onClick={createContract}>Create contract</button>
        </article>
      )}

      {tab === 'Sell' && (
        <article className="card nu-inset">
          <h3>Available contracts</h3>
          {contracts.map((c) => (
            <div key={c.id} style={{ borderBottom: '1px solid #333', padding: '8px 0' }}>
              <b>{c.target_name ?? `Target ${c.target_torn_id}`}</b> — {(c.price_per_loss_cents / 100).toFixed(2)} per loss<br />
              <span className="muted">{c.quantity_total - c.quantity_reserved} of {c.quantity_total} slots remaining</span><br />
              <input className="nu-input" placeholder="Qty to claim" type="number" value={sContractId === c.id ? sQty : ''} onChange={(e) => { setSContractId(c.id); setSQty(e.target.value); }} style={{ width: 100, marginTop: 4 }} />
              <button className="nu-btn" onClick={() => claimSlot(c)}>Claim</button>
            </div>
          ))}
          {contracts.length === 0 && <p className="muted">No open contracts.</p>}
        </article>
      )}

      {tab === 'My Contracts' && (
        <div className="grid">
          {myContracts.map((c) => (
            <article key={c.id} className="card nu-inset">
              <h3>{c.target_name ?? `Target ${c.target_torn_id}`}</h3>
              <p className="muted">{(c.price_per_loss_cents / 100).toFixed(2)} per loss • {c.quantity_verified}/{c.quantity_total} verified</p>
              <span className="badge">{c.status}</span>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {['active', 'funded', 'paused'].includes(c.status) && <button className="nu-btn" onClick={() => cancelContract(c)}>Cancel</button>}
                <button className="nu-btn" onClick={() => raiseDispute(c.id)}>Dispute</button>
              </div>
            </article>
          ))}
          {myContracts.length === 0 && <p className="muted">No contracts yet.</p>}
        </div>
      )}

      {tab === 'Active Claim' && (
        <article className="card nu-inset">
          {activeClaim ? (
            <>
              <h3>Claim on contract {activeClaim.contract_id.slice(0, 8)}</h3>
              <p>Quantity: {activeClaim.quantity_claimed} • Expires {new Date(activeClaim.expires_at).toLocaleTimeString()}</p>
              <button className="nu-btn" onClick={() => addEvidence(activeClaim.id)}>Add attack evidence</button>
              <button className="nu-btn" onClick={() => markComplete(activeClaim)}>Mark complete</button>
              <h4 style={{ marginTop: 12 }}>Evidence</h4>
              {evidence.filter((e) => e.claim_id === activeClaim.id).map((e) => (
                <p key={e.id}>Attack {e.attack_id} — {e.status}</p>
              ))}
            </>
          ) : <p className="muted">No active claim. Claim a slot from the Sell tab.</p>}
        </article>
      )}

      {tab === 'Earnings' && (
        <article className="card nu-inset">
          <h3>Total earned: ${(totalEarned / 100).toFixed(2)}</h3>
          {settlements.map((s) => (
            <p key={s.id}>Contract {s.contract_id.slice(0, 8)} — ${(s.amount_cents / 100).toFixed(2)} — {s.status}</p>
          ))}
          {settlements.length === 0 && <p className="muted">No earnings yet.</p>}
        </article>
      )}

      {tab === 'Payment Queue' && (
        <article className="card nu-inset">
          <h3>Pending payment: ${(pendingPayment / 100).toFixed(2)}</h3>
          {settlements.filter((s) => s.status === 'earned' || s.status === 'approved').map((s) => (
            <div key={s.id} style={{ borderBottom: '1px solid #333', padding: '6px 0' }}>
              Contract {s.contract_id.slice(0, 8)} — ${(s.amount_cents / 100).toFixed(2)} — {s.status}
              {s.status === 'earned' && <button className="nu-btn" onClick={() => approvePayment(s)} style={{ marginLeft: 8 }}>Approve</button>}
              {s.status === 'approved' && <button className="nu-btn" onClick={() => markPaid(s)} style={{ marginLeft: 8 }}>Mark paid</button>}
            </div>
          ))}
          {pendingPayment === 0 && <p className="muted">Nothing pending.</p>}
        </article>
      )}

      {tab === 'Disputes' && (
        <div className="grid">
          {disputes.map((d) => (
            <article key={d.id} className="card nu-inset">
              <h3>Dispute on {d.contract_id.slice(0, 8)}</h3>
              <p>{d.reason}</p>
              <span className="badge">{d.status}</span>
            </article>
          ))}
          {disputes.length === 0 && <p className="muted">No disputes.</p>}
        </div>
      )}
    </section>
  );
}
