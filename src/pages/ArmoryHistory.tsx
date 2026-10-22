import { recordChoices } from "../lib/entry-options";
import DataEntry from "../components/DataEntry";
import SelectEntry from "../components/SelectEntry";
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface ArmoryEvent { id: string; item_name: string; event_type: string; quantity: number; member_name: string; notes: string; created_at: string }
interface Loan { id: string; borrower_torn_id: number; borrower_name: string; principal: number; interest_rate: string; due_date: string; status: string; repaid_amount: number; notes: string; created_at: string }

export default function ArmoryHistory() {
  const [events, setEvents] = useState<ArmoryEvent[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [error, setError] = useState('');

  const [eItem, setEItem] = useState(''); const [eType, setEType] = useState('added'); const [eQty, setEQty] = useState('1'); const [eMember, setEMember] = useState(''); const [eNotes, setENotes] = useState('');
  const [lTornId, setLTornId] = useState(''); const [lName, setLName] = useState(''); const [lPrincipal, setLPrincipal] = useState(''); const [lRate, setLRate] = useState('0'); const [lDue, setLDue] = useState(''); const [lNotes, setLNotes] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [e, l] = await Promise.all([
      supabase.from('faction_armory_events').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('faction_loans').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
    ]);
    if (e.error) setError(e.error.message); else setEvents(e.data ?? []);
    if (l.error) setError(l.error.message); else setLoans(l.data ?? []);
  }

  async function addArmoryEvent() {
    setError('');
    const qty = parseInt(eQty, 10);
    if (!eItem.trim() || isNaN(qty) || qty <= 0) { setError('Enter item name and valid quantity'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('faction_armory_events').insert({ user_id: user.id, item_name: eItem.trim(), event_type: eType, quantity: qty, member_name: eMember.trim() || null, notes: eNotes.trim() || null });
    if (error) setError(error.message);
    else { setEItem(''); setEQty('1'); setEMember(''); setENotes(''); load(); }
  }

  async function addLoan() {
    setError('');
    const tid = parseInt(lTornId, 10);
    const principal = parseInt(lPrincipal, 10);
    if (isNaN(tid) || !lName.trim() || isNaN(principal) || principal <= 0) { setError('Fill borrower Torn ID, name, and valid principal'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('faction_loans').insert({ user_id: user.id, borrower_torn_id: tid, borrower_name: lName.trim(), principal, interest_rate: parseFloat(lRate) || 0, due_date: lDue || null, notes: lNotes.trim() || null });
    if (error) setError(error.message);
    else { setLTornId(''); setLName(''); setLPrincipal(''); setLDue(''); setLNotes(''); load(); }
  }

  async function markRepaid(loan: Loan) {
    setError('');
    const total = Math.round(loan.principal * (1 + parseFloat(loan.interest_rate) / 100));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('faction_loans').update({ status: 'repaid', repaid_amount: total, repaid_at: new Date().toISOString() }).eq('id', loan.id).eq('user_id', user.id);
    if (error) setError(error.message);
    else load();
  }

  async function markDefaulted(loan: Loan) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('faction_loans').update({ status: 'defaulted' }).eq('id', loan.id).eq('user_id', user.id);
    load();
  }

  const activeLoans = loans.filter((l) => l.status === 'active');
  const totalOutstanding = activeLoans.reduce((s, l) => s + Math.round(l.principal * (1 + parseFloat(l.interest_rate) / 100) - l.repaid_amount), 0);

  return (
    <section>
      <h2>Armory History & Loans</h2>
      <p className="muted">Track armory item movements (added/removed/loaned/returned/sold) and manage member loans with interest and due dates.</p>
      {error && <p className="badge warn">{error}</p>}

      <article className="card nu-inset">
        <h3>Outstanding loans: ${totalOutstanding.toLocaleString()}</h3>
        <p className="muted">Across {activeLoans.length} active loan(s).</p>
      </article>

      <article className="card nu-inset">
        <h3>Log armory event</h3>
        <DataEntry source="itemName" className="nu-input" placeholder="Item name" value={eItem} onChange={(e) => setEItem(e.target.value)} />
        <select className="nu-input" value={eType} onChange={(e) => setEType(e.target.value)}>
          <option value="added">Added</option>
          <option value="removed">Removed</option>
          <option value="loaned">Loaned</option>
          <option value="returned">Returned</option>
          <option value="sold">Sold</option>
        </select>
        <SelectEntry kind="count" className="nu-input" type="number" min="1" placeholder="Quantity" value={eQty} onChange={(e) => setEQty(e.target.value)} />
        <DataEntry source="playerName" className="nu-input" placeholder="Member name (for loaned/returned)" value={eMember} onChange={(e) => setEMember(e.target.value)} />
        <input className="nu-input" placeholder="Notes (optional)" value={eNotes} onChange={(e) => setENotes(e.target.value)} />
        <button className="nu-btn" onClick={addArmoryEvent}>Log event</button>
      </article>

      <article className="card nu-inset">
        <h3>Armory history</h3>
        {events.map((e) => (
          <div key={e.id} style={{ borderBottom: '1px solid #333', padding: '6px 0' }}>
            <span>{e.event_type} — {e.quantity}x {e.item_name}{e.member_name ? ` → ${e.member_name}` : ''} — {new Date(e.created_at).toLocaleDateString()}</span>
            {e.notes && <p className="muted" style={{ fontSize: 12 }}>{e.notes}</p>}
          </div>
        ))}
        {events.length === 0 && <p className="muted">No armory events yet.</p>}
      </article>

      <article className="card nu-inset">
        <h3>New loan</h3>
        <DataEntry options={recordChoices(loans,'borrower_torn_id','borrower_name',false)} source="player" onNameChange={setLName} type="number" min="1" step="1" className="nu-input" placeholder="Borrower Torn ID" value={lTornId} onChange={(e) => setLTornId(e.target.value)} />
        <DataEntry options={recordChoices(loans,'borrower_torn_id','borrower_name',true)} source="playerName" className="nu-input" placeholder="Borrower name" value={lName} onChange={(e) => setLName(e.target.value)} />
        <SelectEntry kind="money" className="nu-input" type="number" placeholder="Principal ($)" value={lPrincipal} onChange={(e) => setLPrincipal(e.target.value)} />
        <SelectEntry kind="percent" className="nu-input" type="number" step="0.1" placeholder="Interest rate (%)" value={lRate} onChange={(e) => setLRate(e.target.value)} />
        <input className="nu-input" type="date" value={lDue} onChange={(e) => setLDue(e.target.value)} />
        <input className="nu-input" placeholder="Notes (optional)" value={lNotes} onChange={(e) => setLNotes(e.target.value)} />
        <button className="nu-btn" onClick={addLoan}>Create loan</button>
      </article>

      <article className="card nu-inset">
        <h3>Loans</h3>
        {loans.map((l) => {
          const total = Math.round(l.principal * (1 + parseFloat(l.interest_rate) / 100));
          return (
            <div key={l.id} style={{ borderBottom: '1px solid #333', padding: '6px 0' }}>
              <span>#{l.borrower_torn_id} {l.borrower_name} — ${l.principal.toLocaleString()} @ {l.interest_rate}% = ${total.toLocaleString()} due {l.due_date ?? '—'} — {l.status}</span>
              {l.status === 'active' && (
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button className="nu-btn" onClick={() => markRepaid(l)}>Mark repaid</button>
                  <button className="nu-btn" onClick={() => markDefaulted(l)}>Mark defaulted</button>
                </div>
              )}
            </div>
          );
        })}
        {loans.length === 0 && <p className="muted">No loans yet.</p>}
      </article>
    </section>
  );
}
