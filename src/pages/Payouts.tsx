import DataEntry from "../components/DataEntry";
import SelectEntry from "../components/SelectEntry";
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface War { id: string; name: string; }
interface Line { member_name: string; hits: number; amount: number; }

// Deterministic integer allocation: proportional to hits, rounded down,
// remainder distributed by largest fractional remainder.
function allocate(pool: number, members: Line[]): Line[] {
  const totalHits = members.reduce((s, m) => s + m.hits, 0);
  if (totalHits === 0) return members.map((m) => ({ ...m, amount: 0 }));
  const scaled = members.map((m) => ({ ...m, raw: (m.hits / totalHits) * pool }));
  let allocated = 0;
  const result = scaled.map((m) => {
    const amount = Math.floor(m.raw);
    allocated += amount;
    return { ...m, amount };
  });
  let remainder = pool - allocated;
  const byFrac = result
    .map((m, i) => ({ i, frac: m.raw - m.amount }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of byFrac) {
    if (remainder <= 0) break;
    result[i].amount += 1;
    remainder -= 1;
  }
  return result;
}

export default function Payouts() {
  const [wars, setWars] = useState<War[]>([]);
  const [warId, setWarId] = useState('');
  const [mode, setMode] = useState('proportional');
  const [pool, setPool] = useState('');
  const [members, setMembers] = useState<Line[]>([]);
  const [preview, setPreview] = useState<Line[]>([]);
  const [error, setError] = useState('');

  useEffect(() => { loadWars(); }, []);

  async function loadWars() {
    const { data, error } = await supabase.from('wars').select('id, name').order('created_at', { ascending: false });
    if (error) setError(error.message);
    else {
      setWars(data ?? []);
      if (data?.length && !warId) setWarId(data[0].id);
    }
  }

  function addMember() {
    setMembers([...members, { member_name: '', hits: 0, amount: 0 }]);
  }

  function updateMember(i: number, field: 'member_name' | 'hits', value: string) {
    const next = [...members];
    if (field === 'hits') next[i].hits = parseInt(value) || 0;
    else next[i].member_name = value;
    setMembers(next);
  }

  function calculate() {
    const p = parseInt(pool);
    if (!p || p < 0) { setError('Enter a valid non-negative pool'); return; }
    setError('');
    setPreview(allocate(p, members.filter((m) => m.member_name.trim())));
  }

  async function saveRun() {
    if (!warId || preview.length === 0) return;
    const { data: policy, error: policyError } = await supabase
      .from('payout_policies')
      .insert({ war_id: warId, mode, distributable_pool: parseInt(pool) })
      .select().single();
    if (policyError) { setError(policyError.message); return; }
    const { data: run, error: runError } = await supabase
      .from('payout_runs')
      .insert({ policy_id: policy.id, status: 'draft', total_allocated: preview.reduce((s, m) => s + m.amount, 0) })
      .select().single();
    if (runError) { setError(runError.message); return; }
    const { error: linesError } = await supabase.from('payout_lines').insert(
      preview.map((m) => ({ run_id: run.id, member_name: m.member_name, hits: m.hits, amount: m.amount }))
    );
    if (linesError) setError(linesError.message);
    else setError('');
  }

  const totalAllocated = preview.reduce((s, m) => s + m.amount, 0);

  return (
    <section>
      <h2>Payouts</h2>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>New payout run</h3>
        <select className="nu-input" value={warId} onChange={(e) => setWarId(e.target.value)}>
          {wars.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select className="nu-input" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="proportional">Proportional to hits</option>
          <option value="equal_per_hit">Equal per hit</option>
        </select>
        <SelectEntry kind="money" type="number" step="any" className="nu-input" placeholder="Distributable pool (Torn cash)" value={pool} onChange={(e) => setPool(e.target.value)} />
        <button className="nu-btn" onClick={addMember}>Add member</button>
        <button className="nu-btn" onClick={calculate}>Calculate preview</button>
        <button className="nu-btn" onClick={saveRun} disabled={preview.length === 0}>Save draft run</button>
        {members.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 8 }}>
            <DataEntry source="playerName" className="nu-input" placeholder="Member name" value={m.member_name} onChange={(e) => updateMember(i, 'member_name', e.target.value)} />
            <SelectEntry kind="count" type="number" step="any" className="nu-input" placeholder="Hits" value={m.hits} onChange={(e) => updateMember(i, 'hits', e.target.value)} />
          </div>
        ))}
      </article>
      {preview.length > 0 && (
        <article className="card nu-raised">
          <h3>Preview <span className="badge">deterministic · integer Torn cash</span></h3>
          <table>
            <thead><tr><th>Member</th><th>Hits</th><th>Amount</th></tr></thead>
            <tbody>
              {preview.map((m, i) => (
                <tr key={i}><td>{m.member_name}</td><td>{m.hits}</td><td>{m.amount.toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="muted">Allocated: {totalAllocated.toLocaleString()} / {parseInt(pool).toLocaleString()} {totalAllocated === parseInt(pool) ? '✓ reconciles' : '⚠ check remainder'}</p>
          <p className="muted">Saving creates a draft run — payments are always manual in Torn.</p>
        </article>
      )}
    </section>
  );
}
