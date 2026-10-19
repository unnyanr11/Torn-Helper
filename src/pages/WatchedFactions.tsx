import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Watched { id: string; faction_id: number; faction_name: string; priority: number; refresh_interval_minutes: number; paused: boolean; notes: string | null; }

export default function WatchedFactions() {
  const [items, setItems] = useState<Watched[]>([]);
  const [factionId, setFactionId] = useState('');
  const [factionName, setFactionName] = useState('');
  const [priority, setPriority] = useState('1');
  const [interval, setInterval] = useState('60');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase.from('watched_factions').select('*').order('priority');
    if (error) setError(error.message);
    else setItems(data ?? []);
  }

  async function addWatch() {
    if (!factionId.trim() || !factionName.trim()) { setError('Enter faction ID and name'); return; }
    const { error } = await supabase.from('watched_factions').insert({
      faction_id: parseInt(factionId),
      faction_name: factionName.trim(),
      priority: parseInt(priority) || 1,
      refresh_interval_minutes: parseInt(interval) || 60,
    });
    if (error) setError(error.message);
    else { setFactionId(''); setFactionName(''); setPriority('1'); setInterval('60'); load(); }
  }

  async function togglePause(w: Watched) {
    const { error } = await supabase.from('watched_factions').update({ paused: !w.paused }).eq('id', w.id);
    if (error) setError(error.message);
    else load();
  }

  async function removeWatch(id: string) {
    const { error } = await supabase.from('watched_factions').delete().eq('id', id);
    if (error) setError(error.message);
    else load();
  }

  return (
    <section>
      <h2>Watched Factions</h2>
      <p className="muted">Track up to 30 factions with priority and refresh interval. Paused factions are skipped by background refresh.</p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>Watch a faction</h3>
        <input className="nu-input" placeholder="Faction ID" value={factionId} onChange={(e) => setFactionId(e.target.value)} />
        <input className="nu-input" placeholder="Faction name" value={factionName} onChange={(e) => setFactionName(e.target.value)} />
        <input className="nu-input" placeholder="Priority (1-30)" value={priority} onChange={(e) => setPriority(e.target.value)} />
        <input className="nu-input" placeholder="Refresh interval (minutes)" value={interval} onChange={(e) => setInterval(e.target.value)} />
        <button className="nu-btn" onClick={addWatch}>Watch</button>
      </article>
      <article className="card nu-raised">
        <h3>Watched ({items.length}/30)</h3>
        <table>
          <thead><tr><th>Priority</th><th>Faction</th><th>Refresh</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {items.map((w) => (
              <tr key={w.id}>
                <td>{w.priority}</td>
                <td>{w.faction_name} ({w.faction_id})</td>
                <td>{w.refresh_interval_minutes} min</td>
                <td>{w.paused ? 'Paused' : 'Active'}</td>
                <td>
                  <button className="nu-btn" onClick={() => togglePause(w)}>{w.paused ? 'Resume' : 'Pause'}</button>
                  <button className="nu-btn" onClick={() => removeWatch(w.id)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="muted">No watched factions yet.</p>}
      </article>
    </section>
  );
}
