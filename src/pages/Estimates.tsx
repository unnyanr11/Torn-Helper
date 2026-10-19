import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Setting { id: string; source: string; enabled: boolean; }
interface Estimate { id: string; target_id: number; source: string; estimate: number; fetched_at: string; }

const SOURCES = ['ffscouter', 'tornstats'] as const;

export default function Estimates() {
  const [settings, setSettings] = useState<Record<string, Setting>>({});
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [targetId, setTargetId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const [sRes, eRes] = await Promise.all([
      supabase.from('estimate_settings').select('*'),
      supabase.from('target_estimates').select('*').order('fetched_at', { ascending: false }).limit(50),
    ]);
    if (sRes.error) setError(sRes.error.message);
    else {
      const map: Record<string, Setting> = {};
      (sRes.data ?? []).forEach((r: Setting) => { map[r.source] = r; });
      setSettings(map);
    }
    if (eRes.error) setError(eRes.error.message);
    else setEstimates(eRes.data ?? []);
  }

  async function toggle(source: string) {
    const existing = settings[source];
    if (existing) {
      const { error } = await supabase.from('estimate_settings').update({ enabled: !existing.enabled }).eq('id', existing.id);
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.from('estimate_settings').insert({ source, enabled: true });
      if (error) setError(error.message);
    }
    load();
  }

  async function fetchEstimates() {
    if (!targetId.trim()) { setError('Enter a target ID'); return; }
    setBusy(true);
    setError('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('Not signed in'); setBusy(false); return; }
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-estimates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ target_id: parseInt(targetId) }),
    });
    const json = await resp.json();
    if (!resp.ok) setError(json.error ?? 'Fetch failed');
    await load();
    setBusy(false);
  }

  return (
    <section>
      <h2>Estimates</h2>
      <p className="muted">Opt in to third-party estimate sources (FFScouter, TornStats). Estimates are fetched on demand and stored per target.</p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>Sources</h3>
        {SOURCES.map((s) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span className="capitalize" style={{ flex: 1 }}>{s}</span>
            <button className="nu-btn" onClick={() => toggle(s)}>
              {settings[s]?.enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        ))}
      </article>
      <article className="card nu-inset">
        <h3>Fetch estimates</h3>
        <input className="nu-input" placeholder="Target ID" value={targetId} onChange={(e) => setTargetId(e.target.value)} />
        <button className="nu-btn" disabled={busy} onClick={fetchEstimates}>
          {busy ? 'Fetching…' : 'Fetch'}
        </button>
      </article>
      <article className="card nu-raised">
        <h3>Recent estimates</h3>
        <table>
          <thead><tr><th>Target</th><th>Source</th><th>Estimate</th><th>Fetched</th></tr></thead>
          <tbody>
            {estimates.map((e) => (
              <tr key={e.id}>
                <td>{e.target_id}</td>
                <td className="capitalize">{e.source}</td>
                <td>{e.estimate}</td>
                <td>{new Date(e.fetched_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {estimates.length === 0 && <p className="muted">No estimates yet.</p>}
      </article>
    </section>
  );
}
