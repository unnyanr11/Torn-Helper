import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Contract { id: string; target_torn_id: number; target_name: string; quantity: number; price_per_revive: number; status: string; expires_at: string; notes: string }
interface Claim { id: string; contract_id: string; seller_name: string; quantity_claimed: number; status: string; claimed_at: string; expires_at: string }

export default function ReviveMarketplace() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [error, setError] = useState('');
  const [pendingClaimIds, setPendingClaimIds] = useState<Set<string>>(new Set());
  const [tTornId, setTTornId] = useState(''); const [tName, setTName] = useState(''); const [qty, setQty] = useState(''); const [price, setPrice] = useState(''); const [notes, setNotes] = useState('');
  const [sellerTornId, setSellerTornId] = useState(''); const [sellerName, setSellerName] = useState('');

  useEffect(() => {
    load();
    const contractsChannel = supabase
      .channel('revive_contracts_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'revive_contracts' }, () => load())
      .subscribe();

    const claimsChannel = supabase
      .channel('revive_claims_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'revive_claims' }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(contractsChannel);
      supabase.removeChannel(claimsChannel);
    };
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [c, cl] = await Promise.all([
      supabase.from('revive_contracts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('revive_claims').select('*').eq('seller_user_id', user.id).order('claimed_at', { ascending: false }).limit(50),
    ]);
    if (c.error) setError(c.error.message); else setContracts(c.data ?? []);
    if (cl.error) setError(cl.error.message); else setClaims(cl.data ?? []);
  }

  async function createContract() {
    setError('');
    const tid = parseInt(tTornId, 10); const q = parseInt(qty, 10); const p = parseInt(price, 10);
    if (isNaN(tid) || isNaN(q) || q <= 0 || isNaN(p) || p <= 0) { setError('Fill target Torn ID, quantity, and price per revive'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('revive_contracts').insert({ user_id: user.id, target_torn_id: tid, target_name: tName.trim() || null, quantity: q, price_per_revive: p, notes: notes.trim() || null });
    if (error) setError(error.message);
    else { setTTornId(''); setTName(''); setQty(''); setPrice(''); setNotes(''); load(); }
  }

  async function claimContract(c: Contract) {
    setError('');
    if (!sellerTornId || !sellerName.trim()) { setError('Enter your Torn ID and name to claim'); return; }
    const sid = parseInt(sellerTornId, 10);
    if (isNaN(sid)) { setError('Invalid seller Torn ID'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Optimistic: immediately add a temp claim to UI
    const tempId = `temp-${Date.now()}`;
    const optimisticClaim: Claim = {
      id: tempId,
      contract_id: c.id,
      seller_name: sellerName.trim(),
      quantity_claimed: 1,
      status: 'active',
      claimed_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
    setClaims((prev) => [optimisticClaim, ...prev]);
    setPendingClaimIds((prev) => new Set(prev).add(tempId));

    const { data, error } = await supabase.from('revive_claims').insert({ contract_id: c.id, seller_user_id: user.id, seller_torn_id: sid, seller_name: sellerName.trim(), quantity_claimed: 1 }).select().single();

    if (error) {
      // Rollback optimistic update
      setClaims((prev) => prev.filter((cl) => cl.id !== tempId));
      setPendingClaimIds((prev) => { const n = new Set(prev); n.delete(tempId); return n; });
      setError(error.message);
    } else {
      // Replace temp with real row
      setClaims((prev) => prev.map((cl) => (cl.id === tempId ? data : cl)));
      setPendingClaimIds((prev) => { const n = new Set(prev); n.delete(tempId); return n; });
    }
  }

  async function completeClaim(claim: Claim) {
    // Optimistic: mark completed immediately
    const prevStatus = claim.status;
    setClaims((prev) => prev.map((cl) => (cl.id === claim.id ? { ...cl, status: 'completed', completed_at: new Date().toISOString() } : cl)));
    const { error } = await supabase.from('revive_claims').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', claim.id);
    if (error) {
      // Rollback
      setClaims((prev) => prev.map((cl) => (cl.id === claim.id ? { ...cl, status: prevStatus, completed_at: undefined } : cl)));
      setError(error.message);
    }
  }

  async function cancelContract(c: Contract) {
    await supabase.from('revive_contracts').update({ status: 'cancelled' }).eq('id', c.id);
    load();
  }

  const open = contracts.filter((c) => c.status === 'open');
  const active = claims.filter((c) => c.status === 'active');
  const done = claims.filter((c) => c.status === 'completed');

  return (
    <section>
      <h2>Revive Marketplace</h2>
      <p className="muted">Buy revives or sell your services. Optimistic UI + realtime updates.</p>
      {error && <p className="badge warn">{error}</p>}

      <article className="card nu-inset">
        <h3>Create revive request</h3>
        <input className="nu-input" placeholder="Target Torn ID" value={tTornId} onChange={(e) => setTTornId(e.target.value)} />
        <input className="nu-input" placeholder="Target name (optional)" value={tName} onChange={(e) => setTName(e.target.value)} />
        <input className="nu-input" type="number" placeholder="Quantity" value={qty} onChange={(e) => setQty(e.target.value)} />
        <input className="nu-input" type="number" placeholder="Price per revive ($)" value={price} onChange={(e) => setPrice(e.target.value)} />
        <input className="nu-input" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button className="nu-btn" onClick={createContract}>Create request</button>
      </article>

      <article className="card nu-inset">
        <h3>Open requests ({open.length})</h3>
        <input className="nu-input" placeholder="Your Torn ID (to claim)" value={sellerTornId} onChange={(e) => setSellerTornId(e.target.value)} />
        <input className="nu-input" placeholder="Your name" value={sellerName} onChange={(e) => setSellerName(e.target.value)} />
        {open.map((c) => (
          <div key={c.id} style={{ borderBottom: '1px solid #333', padding: '6px 0' }}>
            <span>#{c.target_torn_id} {c.target_name ?? '—'} — {c.quantity} revive(s) @ ${c.price_per_revive.toLocaleString()} each</span>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button className="nu-btn" onClick={() => claimContract(c)} disabled={pendingClaimIds.size > 0 && [...pendingClaimIds].some(id => claims.find(cl => cl.id === id)?.contract_id === c.id)}>
                Claim 1
              </button>
              <button className="nu-btn" onClick={() => cancelContract(c)}>Cancel</button>
            </div>
          </div>
        ))}
        {open.length === 0 && <p className="muted">No open requests.</p>}
      </article>

      <article className="card nu-inset">
        <h3>My active claims ({active.length})</h3>
        {active.map((cl) => (
          <div key={cl.id} style={{ borderBottom: '1px solid #333', padding: '6px 0', opacity: pendingClaimIds.has(cl.id) ? 0.6 : 1 }}>
            <span>Contract {cl.contract_id.slice(0,8)}… — {cl.quantity_claimed} revive(s) — expires {new Date(cl.expires_at).toLocaleTimeString()} {pendingClaimIds.has(cl.id) && '(saving…)'}</span>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button className="nu-btn" onClick={() => completeClaim(cl)} disabled={pendingClaimIds.has(cl.id)}>Mark complete</button>
            </div>
          </div>
        ))}
        {active.length === 0 && <p className="muted">No active claims.</p>}
      </article>

      <article className="card nu-inset">
        <h3>Completed ({done.length})</h3>
        {done.map((cl) => (
          <div key={cl.id} style={{ borderBottom: '1px solid #333', padding: '6px 0' }}>
            <span>Contract {cl.contract_id.slice(0,8)}… — {cl.quantity_claimed} revive(s) — completed {cl.completed_at ? new Date(cl.completed_at).toLocaleString() : '—'}</span>
          </div>
        ))}
        {done.length === 0 && <p className="muted">Nothing completed yet.</p>}
      </article>
    </section>
  );
}
