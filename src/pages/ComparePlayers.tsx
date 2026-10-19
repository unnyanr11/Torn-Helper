import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Target { id: string; torn_user_id: number; name: string; level: number; status: string; last_action: string }
interface Estimate { id: string; target_id: string; source: string; strength: number; defense: number; speed: number; dexterity: number; total: number; confidence: string }
interface Observation { id: string; target_id: string; status: string; observed_at: string }

export default function ComparePlayers() {
  const [ids, setIds] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');

  async function compare() {
    setError('');
    const parsed = ids.split(/[\s,]+/).map((s) => parseInt(s, 10)).filter((n) => !isNaN(n) && n > 0).slice(0, 5);
    if (parsed.length < 2) { setError('Enter at least 2 player IDs (max 5)'); return; }

    const { data: targets, error: tErr } = await supabase.from('targets').select('*').in('torn_user_id', parsed);
    if (tErr) { setError(tErr.message); return; }
    const targetList = targets ?? [];
    const targetIds = targetList.map((t: any) => t.id);

    const { data: estimates } = targetIds.length > 0 ? await supabase.from('target_estimates').select('*').in('target_id', targetIds) : { data: [] };
    const { data: observations } = targetIds.length > 0 ? await supabase.from('target_observations').select('*').in('target_id', targetIds) : { data: [] };

    const estList = estimates ?? [];
    const obsList = observations ?? [];

    const result = parsed.map((pid) => {
      const t = targetList.find((x: any) => x.torn_user_id === pid);
      const ests = t ? estList.filter((e: any) => e.target_id === t.id) : [];
      const obs = t ? obsList.filter((o: any) => o.target_id === t.id) : [];
      const latestEst = ests.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      const onlineCount = obs.filter((o: any) => o.status === 'online').length;
      return {
        torn_user_id: pid,
        name: t?.name ?? '—',
        level: t?.level ?? '—',
        status: t?.status ?? '—',
        estimate_source: latestEst?.source ?? '—',
        total: latestEst?.total ?? '—',
        confidence: latestEst?.confidence ?? '—',
        observations: obs.length,
        online_rate: obs.length > 0 ? Math.round((onlineCount / obs.length) * 100) + '%' : '—',
      };
    });
    setRows(result);
  }

  const cols = ['Player ID', 'Name', 'Level', 'Status', 'Estimate source', 'Total est.', 'Confidence', 'Observations', 'Online rate'];

  return (
    <section>
      <h2>Compare Players</h2>
      <p className="muted">Enter 2-5 Torn player IDs (comma or space separated). Compares target data, latest estimates, and observation-based online rate side by side. Only players you have added as targets will have full data.</p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <input className="nu-input" placeholder="e.g. 123456, 234567, 345678" value={ids} onChange={(e) => setIds(e.target.value)} />
        <button className="nu-btn" onClick={compare}>Compare</button>
      </article>
      {rows.length > 0 && (
        <div className="card nu-raised" style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.torn_user_id}>
                  <td>{r.torn_user_id}</td><td>{r.name}</td><td>{r.level}</td><td>{r.status}</td>
                  <td>{r.estimate_source}</td><td>{r.total}</td><td>{r.confidence}</td>
                  <td>{r.observations}</td><td>{r.online_rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
