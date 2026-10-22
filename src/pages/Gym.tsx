import SelectEntry from "../components/SelectEntry";
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Session { id: string; session_date: string; energy_spent: number; strength_gain: number; defense_gain: number; speed_gain: number; dexterity_gain: number; notes: string | null; }

export default function Gym() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [energy, setEnergy] = useState('');
  const [str, setStr] = useState('');
  const [def, setDef] = useState('');
  const [spd, setSpd] = useState('');
  const [dex, setDex] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase.from('gym_sessions').select('*').order('session_date', { ascending: false }).limit(100);
    if (error) setError(error.message);
    else setSessions(data ?? []);
  }

  async function addSession() {
    const e = parseInt(energy) || 0;
    if (e <= 0) { setError('Enter energy spent'); return; }
    const { error } = await supabase.from('gym_sessions').insert({
      session_date: date,
      energy_spent: e,
      strength_gain: parseFloat(str) || 0,
      defense_gain: parseFloat(def) || 0,
      speed_gain: parseFloat(spd) || 0,
      dexterity_gain: parseFloat(dex) || 0,
    });
    if (error) setError(error.message);
    else { setEnergy(''); setStr(''); setDef(''); setSpd(''); setDex(''); load(); }
  }

  async function removeSession(id: string) {
    const { error } = await supabase.from('gym_sessions').delete().eq('id', id);
    if (error) setError(error.message);
    else load();
  }

  const totalEnergy = sessions.reduce((s, x) => s + x.energy_spent, 0);
  const totalGain = sessions.reduce((s, x) => s + x.strength_gain + x.defense_gain + x.speed_gain + x.dexterity_gain, 0);
  const perEnergy = totalEnergy > 0 ? (totalGain / totalEnergy).toFixed(4) : '—';

  return (
    <section>
      <h2>Gym Tracker</h2>
      <p className="muted">Log training sessions manually. Gains are observed values you enter — the app does not reconstruct hidden history.</p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>Log session</h3>
        <input className="nu-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <SelectEntry kind="energy" type="number" step="any" className="nu-input" placeholder="Energy spent" value={energy} onChange={(e) => setEnergy(e.target.value)} />
        <SelectEntry kind="decimal" type="number" step="any" className="nu-input" placeholder="Strength gain" value={str} onChange={(e) => setStr(e.target.value)} />
        <SelectEntry kind="decimal" type="number" step="any" className="nu-input" placeholder="Defense gain" value={def} onChange={(e) => setDef(e.target.value)} />
        <SelectEntry kind="decimal" type="number" step="any" className="nu-input" placeholder="Speed gain" value={spd} onChange={(e) => setSpd(e.target.value)} />
        <SelectEntry kind="decimal" type="number" step="any" className="nu-input" placeholder="Dexterity gain" value={dex} onChange={(e) => setDex(e.target.value)} />
        <button className="nu-btn" onClick={addSession}>Log</button>
      </article>
      <article className="card nu-raised">
        <h3>Summary</h3>
        <p>Total energy: {totalEnergy} | Total gains: {totalGain.toFixed(2)} | Gains per energy: {perEnergy}</p>
      </article>
      <article className="card nu-raised">
        <h3>Sessions ({sessions.length})</h3>
        <table>
          <thead><tr><th>Date</th><th>Energy</th><th>Str</th><th>Def</th><th>Spd</th><th>Dex</th><th></th></tr></thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>{s.session_date}</td>
                <td>{s.energy_spent}</td>
                <td>{s.strength_gain}</td>
                <td>{s.defense_gain}</td>
                <td>{s.speed_gain}</td>
                <td>{s.dexterity_gain}</td>
                <td><button className="nu-btn" onClick={() => removeSession(s.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {sessions.length === 0 && <p className="muted">No sessions logged yet.</p>}
      </article>
    </section>
  );
}
