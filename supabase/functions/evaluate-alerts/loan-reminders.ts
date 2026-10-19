// Torn Command Center - loan reminder evaluation (runs inside evaluate-alerts Edge Function)
// Add this block to the existing evaluate-alerts function logic.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function evaluateLoanReminders(supabase: ReturnType<typeof createClient>) {
  const today = new Date().toISOString().slice(0, 10);

  // Find active loans due within the next 3 days (or overdue)
  const { data: dueLoans, error } = await supabase
    .from('faction_loans')
    .select('id, user_id, borrower_name, borrower_torn_id, principal, interest_rate, due_date')
    .eq('status', 'active')
    .lte('due_date', addDays(today, 3));

  if (error) throw error;
  if (!dueLoans?.length) return;

  for (const loan of dueLoans) {
    const overdue = loan.due_date < today;
    const daysUntil = Math.ceil((new Date(loan.due_date).getTime() - new Date(today).getTime()) / 86400000);
    const message = overdue
      ? `Loan from ${loan.borrower_name} (#{loan.borrower_torn_id}) is OVERDUE (due ${loan.due_date}). Principal: $${loan.principal.toLocaleString()} @ ${loan.interest_rate}%.`
      : `Loan from ${loan.borrower_name} (#{loan.borrower_torn_id}) due in ${daysUntil} day(s) (${loan.due_date}). Principal: $${loan.principal.toLocaleString()} @ ${loan.interest_rate}%.`;

    const dedupeKey = `loan_due_${loan.id}_${loan.due_date}`;

    // Insert notification (dedupe_key unique constraint prevents duplicates)
    await supabase.from('notification_events').upsert({
      user_id: loan.user_id,
      rule_id: null,
      message,
      dedupe_key: dedupeKey,
    }, { onConflict: 'user_id,dedupe_key' });

    // Also insert into notifications table for in-app display
    await supabase.from('notifications').insert({
      user_id: loan.user_id,
      title: overdue ? 'Loan overdue' : 'Loan due soon',
      body: message,
    });
  }
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
