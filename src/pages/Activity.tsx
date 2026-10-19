import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Obs { id: string; subject_type: string; subject_id: number; subject_name: string | null; observed_at: string; status: string; }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Activity() {
  const [obs, setObs] = useState<Obs[]>([]);
  const [subjectType, setSubjectType] = useState('player');
  const [subjectId, setSubjectId] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [status, setStatus] = useState('online');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase.from('activity_observations').select('*').order('observed_at', { ascending: false }).limit(500);
    if (error) setError(error.message);
    else setObs(data ?? []);
  }

  async function addObs() {
    if (!subjectId.trim()) { setError('Enter subject ID'); return; }
    const { error } = await supabase.from('activity_observations').insert({
      subject_type: subjectType,
      subject_id: parseInt(subjectId),
      subject_name: subjectName.trim() || null,
      status,
    });
    if (error) setError(error.message);
    else { setSubjectId(''); setSubjectName(''); load(); }
  }

  async function removeObs(id: string) {
    const { error } = await supabase.from('activity_observations').delete().eq('id', id);
    if (error) setError(error.message);
    else load();
  }

  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  obs.forEach((o) => {
    const d = new Date(o.observed_at);
    grid[d.getDay()][d.getHours()]++;
  });
  const max = Math.max(1, ...grid.flat());

  return (
    <section>
      <h2>Activity Heatmaps</h2>
      <p className="muted">Log observed online/idle/offline states manually. The heatmap shows observation density by weekday and hour — gaps mean no data, not inactivity.</p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>Log observation</h3>
        <select className="nu-input" value={subjectType} onChange={(e) => setSubjectType(e.target.value)}>
          <option value="player">Player</option>
          <option value="faction">Faction</option>
        </select>
        <input className="nu-input" placeholder="Subject ID" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} />
        <input className="nu-input" placeholder="Name (optional)" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} />
        <select className="nu-input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="online">Online</option>
          <option value="idle">Idle</option>
          <option value="offline">Offline</option>
        </select>
        <button className="nu-btn" onClick={addObs}>Log</button>
      </article>
      <article className="card nu-raised">
        <h3>Heatmap (observation density)</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ fontSize: '0.7rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th></th>{Array.from({ length: 24 }, (_, h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {DAYS.map((day, di) => (
                <tr key={day}>
                  <td>{day}</td>
                  {grid[di].map((count, hi) => (
                    <td key={hi} style={{
                      width: 18, height: 18, textAlign: 'center',
                      background: count === 0 ? 'transparent' : `rgba(99,102,241,${0.2 + 0.8 * (count / max)})`,
                      border: '1px solid rgba(128,128,128,0.2)',
                    }}>{count || ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">{obs.length} observations loaded. Empty cells = no observation recorded.</p>
      </article>
      <article className="card nu-raised">
        <h3>Recent observations</h3>
        <table>
          <thead><tr><th>Subject</th><th>Status</th><th>When</th><th></th></tr></thead>
          <tbody>
            {obs.slice(0, 20).map((o) => (
              <tr key={o.id}>
                <td>{o.subject_name ?? o.subject_id} ({o.subject_type})</td>
                <td className="capitalize">{o.status}</td>
                <td>{new Date(o.observed_at).toLocaleString()}</td>
                <td><button className="nu-btn" onClick={() => removeObs(o.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {obs.length === 0 && <p className="muted">No observations yet.</p>}
      </article>
    </section>
  );
}
