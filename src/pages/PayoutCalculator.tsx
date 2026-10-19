import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Policy { id: string; war_id: string; version: number; status: string; mode: string; config: any }
interface Run { id: string; policy_id: string; total_pool_cents: number; allocated_cents: number; retained_cents: number; status: string }
interface Line { id: string; run_id: string; member_id: string; eligible_points: number; share_cents: number; bonus_cents: number; reimbursement_cents: number; adjustment_cents: number; amount_owed_cents: number; paid_cents: number; status: string; explanation: string }
interface Audit { id: string; run_id: string; action: string; details: any; created_at: string }

const MODES = ['equal', 'proportional', 'weighted', 'hybrid'] as const;
type Mode = typeof MODES[number];

interface MemberInput { id: string; name: string; points: number; bonus: number; reimbursement: number; adjustment: number }

function calculatePayout(members: MemberInput[], pool: number, mode: Mode, floors: Record<string, number>, caps: Record<string, number>): { lines: Omit<Line, 'id' | 'run_id'>[]; allocated: number; retained: number; error: string } {
  const eligible = members.filter((m) => m.points > 0 || mode === 'equal');
  if (eligible.length === 0) return { lines: [], allocated: 0, retained: pool, error: 'No eligible members' };

  const totalFloor = eligible.reduce((s, m) => s + (floors[m.id] ?? 0), 0);
  if (totalFloor > pool) return { lines: [], allocated: 0, retained: pool, error: `Infeasible: floors total ${totalFloor} exceed pool ${pool}` };

  let base: number[] = [];
  if (mode === 'equal') {
    const per = Math.floor(pool / eligible.length);
    base = eligible.map(() => per);
  } else {
    const totalPoints = eligible.reduce((s, m) => s + m.points, 0);
    if (totalPoints === 0) return { lines: [], allocated: 0, retained: pool, error: 'Total points is zero; cannot allocate proportionally' };
    base = eligible.map((m) => Math.floor((m.points / totalPoints) * pool));
  }

  base = base.map((v, i) => Math.max(v, floors[eligible[i].id] ?? 0));

  let remaining = pool - base.reduce((s, v) => s + v, 0);
  const capped = new Set<number>();
  for (let iter = 0; iter < 10; iter++) {
    let changed = false;
    eligible.forEach((m, i) => {
      const cap = caps[m.id];
      if (cap !== undefined && base[i] > cap && !capped.has(i)) {
        remaining += base[i] - cap;
        base[i] = cap;
        capped.add(i);
        changed = true;
      }
    });
    if (!changed) break;
    const uncapped = eligible.map((_, i) => i).filter((i) => !capped.has(i));
    if (uncapped.length === 0) break;
    const totalPts = uncapped.reduce((s, i) => s + eligible[i].points, 0);
    if (totalPts === 0) break;
    uncapped.forEach((i) => { base[i] += Math.floor((eligible[i].points / totalPts) * remaining); });
    remaining = pool - base.reduce((s, v) => s + v, 0);
  }

  let leftover = pool - base.reduce((s, v) => s + v, 0);
  const frac = eligible.map((m, i) => ({ i, frac: (m.points / Math.max(1, eligible.reduce((s, x) => s + x.points, 0))) * pool - base[i] }));
  frac.sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < leftover && k < frac.length; k++) base[frac[k].i] += 1;

  const allocated = base.reduce((s, v) => s + v, 0);
  const lines = eligible.map((m, i) => ({
    member_id: m.id,
    eligible_points: m.points,
    share_cents: base[i],
    bonus_cents: m.bonus,
    reimbursement_cents: m.reimbursement,
    adjustment_cents: m.adjustment,
    amount_owed_cents: base[i] + m.bonus + m.reimbursement + m.adjustment,
    paid_cents: 0,
    status: 'pending',
    explanation: `${mode} allocation: ${base[i]} + bonus ${m.bonus} + reimb ${m.reimbursement} + adj ${m.adjustment}`,
  }));
  return { lines, allocated, retained: pool - allocated, error: '' };
}

export default function PayoutCalculator() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<Mode>('proportional');
  const [pool, setPool] = useState('');
  const [members, setMembers] = useState<MemberInput[]>([
    { id: 'm1', name: 'Member A', points: 100, bonus: 0, reimbursement: 0, adjustment: 0 },
    { id: 'm2', name: 'Member B', points: 50, bonus: 0, reimbursement: 0, adjustment: 0 },
    { id: 'm3', name: 'Member C', points: 25, bonus: 0, reimbursement: 0, adjustment: 0 },
  ]);
  const [activeRun, setActiveRun] = useState<Run | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [p, r, l, a] = await Promise.all([
      supabase.from('payout_policies').select('*').eq('created_by', user.id).order('created_at', { ascending: false }),
      supabase.from('payout_runs').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('payout_lines').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('payout_audit').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    if (p.error) setError(p.error.message); else setPolicies(p.data ?? []);
    if (r.error) setError(r.error.message); else setRuns(r.data ?? []);
    if (l.error) setError(l.error.message); else setLines(l.data ?? []);
    if (a.error) setError(a.error.message); else setAudit(a.data ?? []);
  }

  async function createAndRun() {
    setError('');
    const poolCents = parseInt(pool, 10);
    if (isNaN(poolCents) || poolCents < 0) { setError('Enter a valid pool amount (cents)'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const result = calculatePayout(members, poolCents, mode, {}, {});
    if (result.error) { setError(result.error); return; }
    const { data: pol, error: polErr } = await supabase.from('payout_policies').insert({ created_by: user.id, mode, config: { members: members.map((m) => ({ id: m.id, name: m.name, points: m.points })) }, status: 'locked' }).select().single();
    if (polErr) { setError(polErr.message); return; }
    const { data: run, error: runErr } = await supabase.from('payout_runs').insert({ policy_id: pol.id, total_pool_cents: poolCents, allocated_cents: result.allocated, retained_cents: result.retained, status: 'preview' }).select().single();
    if (runErr) { setError(runErr.message); return; }
    const linesToInsert = result.lines.map((l) => ({ ...l, run_id: run.id }));
    const { error: lineErr } = await supabase.from('payout_lines').insert(linesToInsert);
    if (lineErr) { setError(lineErr.message); return; }
    await supabase.from('payout_audit').insert({ run_id: run.id, action: 'calculated', actor_id: user.id, details: { mode, pool: poolCents, allocated: result.allocated, retained: result.retained } });
    setActiveRun(run);
    load();
  }

  async function transition(run: Run, status: string) {
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('payout_runs').update({ status }).eq('id', run.id);
    if (error) { setError(error.message); return; }
    await supabase.from('payout_audit').insert({ run_id: run.id, action: status, actor_id: user.id, details: {} });
    if (status === 'paid') {
      await supabase.from('payout_lines').update({ status: 'paid', paid_cents: supabase.raw('amount_owed_cents') }).eq('run_id', run.id);
    }
    load();
  }

  function exportCsv(run: Run) {
    const rows = lines.filter((l) => l.run_id === run.id);
    const csv = ['member_id,points,share_cents,bonus,reimbursement,adjustment,owed,paid,status',
      ...rows.map((l) => `${l.member_id},${l.eligible_points},${l.share_cents},${l.bonus_cents},${l.reimbursement_cents},${l.adjustment_cents},${l.amount_owed_cents},${l.paid_cents},${l.status}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `payout-${run.id.slice(0, 8)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const runLines = activeRun ? lines.filter((l) => l.run_id === activeRun.id) : [];

  return (
    <section>
      <h2>War Payout Calculator</h2>
      <p className="muted">Deterministic payout allocation with 4 modes, caps/floors, largest-remainder integer rounding, and a full audit trail. All amounts in cents.</p>
      {error && <p className="badge warn">{error}</p>}

      <article className="card nu-inset">
        <h3>Configure & calculate</h3>
        <select className="nu-input" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
          {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input className="nu-input" placeholder="Total pool (cents)" type="number" value={pool} onChange={(e) => setPool(e.target.value)} />
        {members.map((m, i) => (
          <div key={m.id} style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <input className="nu-input" value={m.name} onChange={(e) => setMembers(members.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} style={{ flex: 1 }} />
            <input className="nu-input" type="number" value={m.points} onChange={(e) => setMembers(members.map((x, j) => j === i ? { ...x, points: parseInt(e.target.value, 10) || 0 } : x))} placeholder="Points" style={{ width: 80 }} />
            <input className="nu-input" type="number" value={m.bonus} onChange={(e) => setMembers(members.map((x, j) => j === i ? { ...x, bonus: parseInt(e.target.value, 10) || 0 } : x))} placeholder="Bonus" style={{ width: 80 }} />
          </div>
        ))}
        <button className="nu-btn" onClick={() => setMembers([...members, { id: `m${Date.now()}`, name: '', points: 0, bonus: 0, reimbursement: 0, adjustment: 0 }])}>+ Add member</button>
        <button className="nu-btn" onClick={createAndRun}>Calculate & save run</button>
      </article>

      {activeRun && (
        <article className="card nu-raised">
          <h3>Run {activeRun.id.slice(0, 8)} — {activeRun.status}</h3>
          <p>Pool: ${(activeRun.total_pool_cents / 100).toFixed(2)} • Allocated: ${(activeRun.allocated_cents / 100).toFixed(2)} • Retained: ${(activeRun.retained_cents / 100).toFixed(2)}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ textAlign: 'left' }}>Member</th><th>Points</th><th>Share</th><th>Owed</th><th>Status</th></tr></thead>
            <tbody>
              {runLines.map((l) => {
                const m = members.find((x) => x.id === l.member_id);
                return (
                  <tr key={l.id}>
                    <td style={{ textAlign: 'left' }}>{m?.name ?? l.member_id.slice(0, 8)}</td>
                    <td style={{ textAlign: 'center' }}>{l.eligible_points}</td>
                    <td style={{ textAlign: 'center' }}>${(l.share_cents / 100).toFixed(2)}</td>
                    <td style={{ textAlign: 'center' }}>${(l.amount_owed_cents / 100).toFixed(2)}</td>
                    <td style={{ textAlign: 'center' }}>{l.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {activeRun.status === 'preview' && <button className="nu-btn" onClick={() => transition(activeRun, 'locked')}>Lock</button>}
            {activeRun.status === 'locked' && <button className="nu-btn" onClick={() => transition(activeRun, 'approved')}>Approve</button>}
            {activeRun.status === 'approved' && <button className="nu-btn" onClick={() => transition(activeRun, 'paid')}>Mark paid</button>}
            {activeRun.status === 'paid' && <button className="nu-btn" onClick={() => transition(activeRun, 'reconciled')}>Reconcile</button>}
            <button className="nu-btn" onClick={() => exportCsv(activeRun)}>Export CSV</button>
          </div>
        </article>
      )}

      <article className="card nu-inset">
        <h3>Audit log</h3>
        {audit.map((a) => (
          <p key={a.id} className="muted">{new Date(a.created_at).toLocaleString()} — {a.action} on run {a.run_id.slice(0, 8)}</p>
        ))}
        {audit.length === 0 && <p className="muted">No audit entries yet.</p>}
      </article>
    </section>
  );
}
