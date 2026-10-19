import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Row { [key: string]: unknown }

const SOURCES = [
  { key: 'planner_items', label: 'Planner items' },
  { key: 'targets', label: 'Targets' },
  { key: 'target_observations', label: 'Target observations' },
  { key: 'activity_observations', label: 'Activity observations' },
  { key: 'gym_sessions', label: 'Gym sessions' },
  { key: 'travel_observations', label: 'Travel observations' },
  { key: 'market_watchlist', label: 'Market watchlist' },
  { key: 'stock_holdings', label: 'Stock holdings' },
  { key: 'company_snapshots', label: 'Company snapshots' },
  { key: 'property_snapshots', label: 'Property snapshots' },
  { key: 'race_logs', label: 'Race logs' },
  { key: 'community_posts', label: 'Community posts' },
  { key: 'graffiti_posts', label: 'Graffiti posts' },
  { key: 'watched_factions', label: 'Watched factions' },
  { key: 'recruitment_candidates', label: 'Recruitment candidates' },
];

function toCsv(rows: Row[]): string {
  if (rows.length === 0) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

export default function Reports() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const next: Record<string, number> = {};
    for (const s of SOURCES) {
      const { count, error } = await supabase.from(s.key).select('*', { count: 'exact', head: true });
      if (!error && count !== null) next[s.key] = count;
    }
    setCounts(next);
  }

  async function exportCsv(key: string, label: string) {
    const { data, error } = await supabase.from(key).select('*').limit(10000);
    if (error) { setError(error.message); return; }
    const csv = toCsv(data ?? []);
    if (!csv) { setError('No rows to export'); return; }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `torn-helper-${key}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setError('');
  }

  return (
    <section>
      <h2>Exports & Reports</h2>
      <p className="muted">Download your data as CSV (up to 10,000 rows per export). Row counts reflect what you can access under RLS.</p>
      {error && <p className="badge warn">{error}</p>}
      <div className="grid">
        {SOURCES.map((s) => (
          <article key={s.key} className="card nu-inset">
            <h3>{s.label}</h3>
            <p className="muted">{counts[s.key] ?? 0} rows</p>
            <button className="nu-btn" onClick={() => exportCsv(s.key, s.label)}>Export CSV</button>
          </article>
        ))}
      </div>
    </section>
  );
}
