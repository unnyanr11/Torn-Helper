import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Contract {
  id: string;
  target_player_id: string;
  target_name: string | null;
  quantity: number;
  price_per_loss: string;
  status: string;
  buyer_user_id: string;
}
interface Claim {
  id: string;
  contract_id: string;
  quantity: number;
  status: string;
  expires_at: string;
}

export default function Losses() {
  const [tab, setTab] = useState<'buy' | 'sell' | 'mine'>('buy');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [myContracts, setMyContracts] = useState<Contract[]>([]);
  const [myClaims, setMyClaims] = useState<Claim[]>([]);
  const [targetId, setTargetId] = useState('');
  const [targetName, setTargetName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { load(); }, [tab]);

  async function load() {
    setError(''); setNotice('');
    if (tab === 'buy') {
      const { data, error } = await supabase.from('loss_contracts').select('*').eq('status', 'open').order('created_at', { ascending: false });
      if (error) setError(error.message); else setContracts(data ?? []);
    } else if (tab === 'sell') {
      const { data, error } = await supabase.from('loss_contracts').select('*').eq('status', 'open').order('created_at', { ascending: false });
      if (error) setError(error.message); else setContracts(data ?? []);
    } else {
      const [cRes, clRes] = await Promise.all([
        supabase.from('loss_contracts').select('*').order('created_at', { ascending: false }),
        supabase.from('loss_claims').select('*').order('claimed_at', { ascending: false }),
      ]);
      if (cRes.error) setError(cRes.error.message); else setMyContracts(cRes.data ?? []);
      if (clRes.error) setError(clRes.error.message); else setMyClaims(clRes.data ?? []);
    }
  }

  async function createContract() {
    if (!targetId.trim() || !quantity || !price) { setError('Fill in target ID, quantity and price'); return; }
    const { error } = await supabase.from('loss_contracts').insert({
      target_player_id: targetId.trim(),
      target_name: targetName.trim() || null,
      quantity: parseInt(quantity),
      price_per_loss: price,
      funding_method: 'direct_payment',
    });
    if (error) setError(error.message);
    else { setNotice('Contract created (direct payment — settle manually in Torn)'); setTargetId(''); setTargetName(''); setQuantity(''); setPrice(''); load(); }
  }

  async function claimSlot(contract: Contract) {
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error } = await supabase.from('loss_claims').insert({
      contract_id: contract.id,
      quantity: 1,
      expires_at: expires,
    });
    if (error) setError(error.message);
    else { setNotice('Slot claimed — complete within 15 minutes, then mark complete'); load(); }
  }

  async function completeClaim(claim: Claim) {
    const { error } = await supabase.from('loss_claims').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', claim.id);
    if (error) setError(error.message);
    else { setNotice('Claim marked complete — awaiting buyer verification/settlement'); load(); }
  }

  return (
    <section>
      <h2>Losses</h2>
      <p className="badge">Direct-payment contracts — no operator custody, no automatic payouts. Settle manually in Torn.</p>
      {error && <p className="badge warn">{error}</p>}
      {notice && <p className="badge ok">{notice}</p>}
      <div className="meta">
        <button className={`nu-btn ${tab === 'buy' ? 'active' : ''}`} onClick={() => setTab('buy')}>Buy Losses</button>
        <button className={`nu-btn ${tab === 'sell' ? 'active' : ''}`} onClick={() => setTab('sell')}>Sell Losses</button>
        <button className={`nu-btn ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>My Contracts</button>
      </div>
      {tab === 'buy' && (
        <article className="card nu-inset">
          <h3>Create buy-losses contract</h3>
          <input className="nu-input" placeholder="Target Torn player ID" value={targetId} onChange={(e) => setTargetId(e.target.value)} />
          <input className="nu-input" placeholder="Target name (optional)" value={targetName} onChange={(e) => setTargetName(e.target.value)} />
          <input className="nu-input" placeholder="Quantity of losses" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <input className="nu-input" placeholder="Price per loss (Torn cash)" value={price} onChange={(e) => setPrice(e.target.value)} />
          <button className="nu-btn" onClick={createContract}>Create contract</button>
        </article>
      )}
      {(tab === 'buy' || tab === 'sell') && (
        <div className="grid">
          {contracts.map((c) => (
            <article key={c.id} className="card nu-raised">
              <h3>{c.target_name ?? `Target ${c.target_player_id}`}</h3>
              <p className="muted">{c.quantity} losses · {c.price_per_loss} each</p>
              <p className="muted">Status: {c.status}</p>
              {tab === 'sell' && <button className="nu-btn" onClick={() => claimSlot(c)}>Claim 1 slot</button>}
            </article>
          ))}
          {contracts.length === 0 && <p className="muted">No open contracts.</p>}
        </div>
      )}
      {tab === 'mine' && (
        <>
          <article className="card nu-raised">
            <h3>My contracts</h3>
            <table>
              <thead><tr><th>Target</th><th>Qty</th><th>Price</th><th>Status</th></tr></thead>
              <tbody>
                {myContracts.map((c) => (
                  <tr key={c.id}><td>{c.target_name ?? c.target_player_id}</td><td>{c.quantity}</td><td>{c.price_per_loss}</td><td>{c.status}</td></tr>
                ))}
              </tbody>
            </table>
            {myContracts.length === 0 && <p className="muted">No contracts yet.</p>}
          </article>
          <article className="card nu-inset">
            <h3>My claims</h3>
            <table>
              <thead><tr><th>Contract</th><th>Qty</th><th>Status</th><th>Expires</th><th></th></tr></thead>
              <tbody>
                {myClaims.map((cl) => (
                  <tr key={cl.id}>
                    <td>{cl.contract_id.slice(0, 8)}…</td>
                    <td>{cl.quantity}</td>
                    <td>{cl.status}</td>
                    <td>{new Date(cl.expires_at).toLocaleTimeString()}</td>
                    <td>{cl.status === 'active' && <button className="nu-btn" onClick={() => completeClaim(cl)}>Mark complete</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {myClaims.length === 0 && <p className="muted">No claims yet.</p>}
          </article>
        </>
      )}
    </section>
  );
}
