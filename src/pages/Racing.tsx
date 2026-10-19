import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface RaceRecord { id: string; track_name: string; car_name: string | null; position: number | null; time_ms: number | null; raced_at: string; }

export default function Racing() {
  const [records, setRecords] = useState<RaceRecord[]>([]);
  const [track, setTrack] = useState('');
  const [car, setCar] = useState('');
  const [position, setPosition] = useState('');
  const [timeMs, setTimeMs] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase.from('racing_records').select('*').order('raced_at', { ascending: false }).limit(50);
    if (error) setError(error.message);
    else setRecords(data ?? []);
  }

  async function addRecord() {
    if (!track.trim()) { setError('Enter a track name'); return; }
    const { error } = await supabase.from('racing_records').insert({
      track_name: track.trim(),
      car_name: car.trim() || null,
      position: position ? parseInt(position) : null,
      time_ms: timeMs ? parseInt(timeMs) : null,
    });
    if (error) setError(error.message);
    else { setTrack(''); setCar(''); setPosition(''); setTimeMs(''); load(); }
  }

  async function removeRecord(id: string) {
    const { error } = await supabase.from('racing_records').delete().eq('id', id);
    if (error) setError(error.message);
    else load();
  }

  const best = records.filter((r) => r.time_ms != null).sort((a, b) => (a.time_ms ?? 0) - (b.time_ms ?? 0))[0];

  return (
    <section>
      <h2>Racing</h2>
      <p className="muted">Manual race log. Live race data the API withholds is not exposed.</p>
      {error && <p className="badge warn">{error}</p>}
      {best && <p className="badge ok">Best time: {best.time_ms} ms on {best.track_name}</p>}
      <article className="card nu-inset">
        <h3>Log a race</h3>
        <input className="nu-input" placeholder="Track name" value={track} onChange={(e) => setTrack(e.target.value)} />
        <input className="nu-input" placeholder="Car name (optional)" value={car} onChange={(e) => setCar(e.target.value)} />
        <input className="nu-input" placeholder="Position" value={position} onChange={(e) => setPosition(e.target.value)} />
        <input className="nu-input" placeholder="Time (ms)" value={timeMs} onChange={(e) => setTimeMs(e.target.value)} />
        <button className="nu-btn" onClick={addRecord}>Log race</button>
      </article>
      <article className="card nu-raised">
        <h3>Recent races</h3>
        <table>
          <thead><tr><th>Track</th><th>Car</th><th>Pos</th><th>Time</th><th>When</th><th></th></tr></thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td>{r.track_name}</td>
                <td>{r.car_name ?? '—'}</td>
                <td>{r.position ?? '—'}</td>
                <td>{r.time_ms ?? '—'}</td>
                <td>{new Date(r.raced_at).toLocaleString()}</td>
                <td><button className="nu-btn" onClick={() => removeRecord(r.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.length === 0 && <p className="muted">No races logged yet.</p>}
      </article>
    </section>
  );
}
