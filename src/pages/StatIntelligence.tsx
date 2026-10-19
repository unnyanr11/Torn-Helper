import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Target { id: string; torn_user_id: number; name: string; level: number }
interface Observation { id: string; target_id: string; status: string; observed_at: string }

function estimateFromData(target: Target, observations: Observation[]) {
  const levelFactor = Math.pow(Math.max(target.level ?? 1, 1), 2.2);
  const onlineCount = observations.filter((o) => o.status === 'online').length;
  const activityRate = observations.length > 0 ? onlineCount / observations.length : 0;
  const activityFactor = 1 + activityRate * 0.5;
  const estimate = Math.round(levelFactor * activityFactor);
  const confidence = observations.length >= 10 ? 'high' : observations.length >= 3 ? 'medium' : 'low';
  return { estimate, confidence, activityRate, observations: observations.length };
}

export default function StatIntelligence() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setError('');
    const { data: t, error: tErr } = await supabase.from('targets').select('id, torn_user_id, name, level').order('name');
    if (tErr) { setError(tErr.message); return; }
    setTargets(t ?? []);
    const { data: o, error: oErr } = await supabase.from('target_observations').select('*').order('observed_at', { ascending: false }).limit(1000);
    if (oErr) { setError(oErr.message); return; }
    setObservations(o ?? []);
  }

  const ranked = targets
    .map((t) => {
      const obs = observations.filter((o) => o.target_id === t.id);
      return { target: t, ...estimateFromData(t, obs) };
    })
    .sort((a, b) => b.estimate - a.estimate);

  const selectedData = ranked.find((r) => r.target.id === selected);
  const history = selected ? observations.filter((o) => o.target_id === selected).slice(0, 20).reverse() : [];
  const maxEst = Math.max(...ranked.map((r) => r.estimate), 1);

  return (
    <section>
      <h2>Stat Intelligence</h2>
      <p className="muted">Native estimate engine - computes rough battle-stat bands from your own target data (level + observation-derived activity). No third-party APIs. Low-observation targets are flagged with low confidence.</p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>Target detail</h3>
        <select className="nu-input" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Select target…</option>
          {targets.map((t) => <option key={t.id} value={t.id}>{t.name ?? `Player ${t.torn_user_id}`}</option>)}
        </select>
      </article>
      {selectedData && (
        <article className="card nu-raised">
          <h3>{selectedData.target.name ?? `Player ${selectedData.target.torn_user_id}`}</h3>
          <p>Estimated battle stats: <strong>{selectedData.estimate.toLocaleString()}</strong></p>
          <p>Confidence: <strong>{selectedData.confidence}</strong> ({selectedData.observations} observations)</p>
          <p>Activity rate: {Math.round(selectedData.activityRate * 100)}%</p>
          <p className="muted">Trend (last {history.length} observations):</p>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 60 }}>
            {history.map((o) => (
              <div key={o.id} style={{ width: 12, background: o.status === 'online' ? 'var(--accent)' : 'var(--surface)', height: `${o.status === 'online' ? 100 : 30}%` }} title={new Date(o.observed_at).toLocaleString()} />
            ))}
          </div>
        </article>
      )}
      <div className="grid">
        {ranked.map((r) => (
          <article key={r.target.id} className="card nu-inset">
            <h3>{r.target.name ?? `Player ${r.target.torn_user_id}`}</h3>
            <p>Estimate: <strong>{r.estimate.toLocaleString()}</strong></p>
            <div style={{ background: 'var(--surface)', borderRadius: 4, height: 10, overflow: 'hidden' }}>
              <div style={{ width: `${(r.estimate / maxEst) * 100}%`, background: 'var(--accent)', height: '100%' }} />
            </div>
            <p className="muted">{r.confidence} confidence · {r.observations} obs</p>
          </article>
        ))}
        {ranked.length === 0 && <p className="muted">No targets yet. Add targets to generate estimates.</p>}
      </div>
    </section>
  );
}
