import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface SpyReport { id: string; target_torn_id: number; target_name: string; strength: number; defense: number; speed: number; dexterity: number; total: number; reported_at: string }

export default function SpyReports() {
  const [reports, setReports] = useState<SpyReport[]>([]);
  const [bulk, setBulk] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase.from('spy_reports').select('*').order('reported_at', { ascending: false }).limit(200);
    if (error) setError(error.message);
    else setReports(data ?? []);
  }

  async function importBulk() {
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const rows = bulk.split('\n').map((l) => l.split(/[\t,]+/).map((s) => s.trim())).filter((p) => p.length >= 6 && !isNaN(parseInt(p[0], 10)));
    if (rows.length === 0) { setError('No valid rows found. Format: ID, Name, STR, DEF, SPD, DEX'); return; }
    const inserts = rows.map((p) => ({
      user_id: user.id,
      target_torn_id: parseInt(p[0], 10),
      target_name: p[1],
      strength: parseInt(p[2], 10) || 0,
      defense: parseInt(p[3], 10) || 0,
      speed: parseInt(p[4], 10) || 0,
      dexterity: parseInt(p[5], 10) || 0,
      total: (parseInt(p[2], 10) || 0) + (parseInt(p[3], 10) || 0) + (parseInt(p[4], 10) || 0) + (parseInt(p[5], 10) || 0),
    }));
    const { error } = await supabase.from('spy_reports').insert(inserts);
    if (error) setError(error.message);
    else { setBulk(''); load(); }
  }

  async function remove(r: SpyReport) {
    await supabase.from('spy_reports').delete().eq('id', r.id);
    load();
  }

  return (
    <section>
      <h2>Spy Reports</h2>
      <p className="muted">Import spy reports (one per line: ID, Name, STR, DEF, SPD, DEX). Stored owner-only; used by Stat Intelligence for build detection.</p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>Bulk import</h3>
        <textarea className="nu-input" rows={5} placeholder="123456, PlayerName, 1000000, 900000, 800000, 700000" value={bulk} onChange={(e) => setBulk(e.target.value)} />
        <button className="nu-btn" onClick={importBulk}>Import</button>
      </article>
      <div className="grid">
        {reports.map((r) => (
          <article key={r.id} className="card nu-inset">
            <h3>{r.target_name ?? `Player ${r.target_torn_id}`}</h3>
            <p className="muted">ID: {r.target_torn_id}</p>
            <p>STR {r.strength?.toLocaleString()} · DEF {r.defense?.toLocaleString()} · SPD {r.speed?.toLocaleString()} · DEX {r.dexterity?.toLocaleString()}</p>
            <p>Total: {r.total?.toLocaleString()}</p>
            <p className="muted">{new Date(r.reported_at).toLocaleString()}</p>
            <button className="nu-btn" onClick={() => remove(r)}>Delete</button>
          </article>
        ))}
        {reports.length === 0 && <p className="muted">No spy reports yet.</p>}
      </div>
    </section>
  );
}
