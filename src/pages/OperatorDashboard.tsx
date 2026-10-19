import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Settlement { id: string; claim_id: string; seller_user_id: string; amount_owed: number; amount_paid: number; status: string; approved_at: string; sent_at: string; reconciled_at: string; transaction_ref: string; notes: string }
interface Dispute { id: string; claim_id: string; raised_by: string; reason: string; status: string; resolved_at: string; resolution_notes: string }
interface Funding { id: string; contract_id: string; buyer_user_id: string; amount: number; currency: string; status: string; verified_at: string; verified_by: string; transaction_ref: string }

export default function OperatorDashboard() {
  const [role, setRole] = useState('');
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [funding, setFunding] = useState<Funding[]>([]);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    setRole(profile?.role ?? 'user');

    const [s, d, f] = await Promise.all([
      supabase.from('loss_settlement_entries').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('loss_disputes').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('loss_funding_records').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    if (s.error) setError(s.error.message); else setSettlements(s.data ?? []);
    if (d.error) setError(d.error.message); else setDisputes(d.data ?? []);
    if (f.error) setError(f.error.message); else setFunding(f.data ?? []);
  }

  async function approveSettlement(s: Settlement) {
    await supabase.from('loss_settlement_entries').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', s.id);
    load();
  }

  async function markSent(s: Settlement) {
    const ref = prompt('Enter Torn transaction reference:');
    if (!ref) return;
    await supabase.from('loss_settlement_entries').update({ status: 'sent', sent_at: new Date().toISOString(), transaction_ref: ref, amount_paid: s.amount_owed }).eq('id', s.id);
    load();
  }

  async function markReconciled(s: Settlement) {
    await supabase.from('loss_settlement_entries').update({ status: 'reconciled', reconciled_at: new Date().toISOString() }).eq('id', s.id);
    load();
  }

  async function resolveDispute(d: Dispute, outcome: 'resolved' | 'rejected') {
    const notes = prompt('Resolution notes:');
    if (notes === null) return;
    await supabase.from('loss_disputes').update({ status: outcome, resolved_at: new Date().toISOString(), resolution_notes: notes }).eq('id', d.id);
    load();
  }

  if (role !== 'payment_operator' && role !== 'admin') {
    return (
      <section>
        <h2>Operator Dashboard</h2>
        <p className="badge warn">Access denied — requires payment_operator or admin role.</p>
      </section>
    );
  }

  const earned = settlements.filter((s) => s.status === 'earned');
  const approved = settlements.filter((s) => s.status === 'approved');
  const sent = settlements.filter((s) => s.status === 'sent');
  const reconciled = settlements.filter((s) => s.status === 'reconciled');
  const openDisputes = disputes.filter((d) => d.status === 'open');
  const pendingFunding = funding.filter((f) => f.status === 'pending');

  return (
    <section>
      <h2>Operator Dashboard</h2>
      <p className="muted">Role: {role} — manage settlements, disputes, and funding audit across all sellers.</p>
      {error && <p className="badge warn">{error}</p>}

      <article className="card nu-inset">
        <h3>Pending funding ({pendingFunding.length})</h3>
        {pendingFunding.map((f) => (
          <div key={f.id} style={{ borderBottom: '1px solid #333', padding: '6px 0' }}>
            <span>Contract {f.contract_id.slice(0,8)}… — {f.amount} {f.currency} — {f.status}</span>
          </div>
        ))}
        {pendingFunding.length === 0 && <p className="muted">No pending funding.</p>}
      </article>

      <article className="card nu-inset">
        <h3>Earned ({earned.length})</h3>
        {earned.map((s) => (
          <div key={s.id} style={{ borderBottom: '1px solid #333', padding: '6px 0' }}>
            <span>Seller {s.seller_user_id.slice(0,8)}… — Claim {s.claim_id.slice(0,8)}… — owed ${s.amount_owed.toLocaleString()}</span>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button className="nu-btn" onClick={() => approveSettlement(s)}>Approve</button>
            </div>
          </div>
        ))}
        {earned.length === 0 && <p className="muted">Nothing pending approval.</p>}
      </article>

      <article className="card nu-inset">
        <h3>Approved ({approved.length})</h3>
        {approved.map((s) => (
          <div key={s.id} style={{ borderBottom: '1px solid #333', padding: '6px 0' }}>
            <span>Seller {s.seller_user_id.slice(0,8)}… — Claim {s.claim_id.slice(0,8)}… — owed ${s.amount_owed.toLocaleString()}</span>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button className="nu-btn" onClick={() => markSent(s)}>Mark sent</button>
            </div>
          </div>
        ))}
        {approved.length === 0 && <p className="muted">Nothing awaiting payment.</p>}
      </article>

      <article className="card nu-inset">
        <h3>Sent ({sent.length})</h3>
        {sent.map((s) => (
          <div key={s.id} style={{ borderBottom: '1px solid #333', padding: '6px 0' }}>
            <span>Seller {s.seller_user_id.slice(0,8)}… — paid ${s.amount_paid.toLocaleString()} — ref {s.transaction_ref}</span>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button className="nu-btn" onClick={() => markReconciled(s)}>Mark reconciled</button>
            </div>
          </div>
        ))}
        {sent.length === 0 && <p className="muted">Nothing awaiting reconciliation.</p>}
      </article>

      <article className="card nu-inset">
        <h3>Reconciled ({reconciled.length})</h3>
        {reconciled.map((s) => (
          <div key={s.id} style={{ borderBottom: '1px solid #333', padding: '6px 0' }}>
            <span>Seller {s.seller_user_id.slice(0,8)}… — paid ${s.amount_paid.toLocaleString()} — ref {s.transaction_ref}</span>
          </div>
        ))}
        {reconciled.length === 0 && <p className="muted">Nothing reconciled yet.</p>}
      </article>

      <article className="card nu-inset">
        <h3>Open disputes ({openDisputes.length})</h3>
        {openDisputes.map((d) => (
          <div key={d.id} style={{ borderBottom: '1px solid #333', padding: '6px 0' }}>
            <span>Claim {d.claim_id.slice(0,8)}… — {d.reason}</span>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button className="nu-btn" onClick={() => resolveDispute(d, 'resolved')}>Resolve</button>
              <button className="nu-btn" onClick={() => resolveDispute(d, 'rejected')}>Reject</button>
            </div>
          </div>
        ))}
        {openDisputes.length === 0 && <p className="muted">No open disputes.</p>}
      </article>
    </section>
  );
}
