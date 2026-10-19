import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Loan { id: string; borrower_name: string; borrower_torn_id: number; principal: number; interest_rate: string; due_date: string; status: string }

export default function LoanReminders() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [error, setError] = useState('');
  const [dueSoonDays, setDueSoonDays] = useState('3');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from('faction_loans').select('*').eq('user_id', user.id).eq('status', 'active').order('due_date', { ascending: true });
    if (error) setError(error.message); else setLoans(data ?? []);
    const { data: rule } = await supabase.from('alert_rules').select('due_soon_days').eq('user_id', user.id).eq('condition_type', 'loan_due').maybeSingle();
    if (rule) setDueSoonDays(String(rule.due_soon_days));
  }

  async function saveThreshold() {
    setError('');
    const days = parseInt(dueSoonDays, 10);
    if (isNaN(days) || days < 0) { setError('Enter a valid number of days'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('alert_rules').upsert({ user_id: user.id, name: 'Loan due reminder', condition_type: 'loan_due', threshold: { due_soon_days: days }, due_soon_days: days, enabled: true }, { onConflict: 'user_id,condition_type' });
    if (error) setError(error.message);
  }

  const today = new Date().toISOString().slice(0, 10);
  const threshold = parseInt(dueSoonDays, 10) || 3;
  const dueSoon = loans.filter((l) => {
    if (!l.due_date) return false;
    const diff = Math.ceil((new Date(l.due_date).getTime() - new Date(today).getTime()) / 86400000);
    return diff <= threshold;
  });

  return (
    <section>
      <h2>Loan Reminders</h2>
      <p className="muted">Automated reminders for loans approaching their due date (or overdue). The evaluate-alerts cron job checks every 5 minutes and creates a deduplicated notification per loan per due date.</p>
      {error && <p className="badge warn">{error}</p>}

      <article className="card nu-inset">
        <h3>Reminder threshold</h3>
        <input className="nu-input" type="number" min="0" placeholder="Days before due date" value={dueSoonDays} onChange={(e) => setDueSoonDays(e.target.value)} />
        <button className="nu-btn" onClick={saveThreshold}>Save threshold</button>
        <p className="muted" style={{ marginTop: 6 }}>Reminders fire when a loan's due date is within this many days (or already past).</p>
      </article>

      <article className="card nu-inset">
        <h3>Loans due soon ({dueSoon.length})</h3>
        {dueSoon.map((l) => {
          const overdue = l.due_date < today;
          const days = Math.ceil((new Date(l.due_date).getTime() - new Date(today).getTime()) / 86400000);
          return (
            <div key={l.id} style={{ borderBottom: '1px solid #333', padding: '6px 0' }}>
              <span>{l.borrower_name} (#{l.borrower_torn_id}) — ${l.principal.toLocaleString()} @ {l.interest_rate}% — due {l.due_date} — {overdue ? 'OVERDUE' : `${days} day(s) left`}</span>
            </div>
          );
        })}
        {dueSoon.length === 0 && <p className="muted">No loans due within {threshold} day(s).</p>}
      </article>
    </section>
  );
}
