import ChoiceInput from "../components/ChoiceInput";
import { useTornChoices } from "../hooks/useTornChoices";
import { catalogueChoices } from "../lib/torn-choices";
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface CrimeLog { id: string; crime_name: string; attempts: number; successes: number; recorded_at: string }

export default function CrimeTracker() {
  const choices=useTornChoices();
  const [logs, setLogs] = useState<CrimeLog[]>([]);
  const [crimeName, setCrimeName] = useState('');
  const [attempts, setAttempts] = useState('1');
  const [successes, setSuccesses] = useState('0');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase.from('crime_logs').select('*').order('recorded_at', { ascending: false }).limit(200);
    if (error) setError(error.message);
    else setLogs(data ?? []);
  }

  async function add() {
    setError('');
    const a = parseInt(attempts, 10);
    const s = parseInt(successes, 10);
    if (!crimeName.trim() || isNaN(a) || a <= 0 || isNaN(s) || s < 0 || s > a) { setError('Enter crime name, attempts (>0), and successes (0-attempts)'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('crime_logs').insert({ user_id: user.id, crime_name: crimeName.trim(), attempts: a, successes: s });
    if (error) setError(error.message);
    else { setCrimeName(''); setAttempts('1'); setSuccesses('0'); load(); }
  }

  const perCrime: Record<string, { attempts: number; successes: number }> = {};
  logs.forEach((l) => {
    perCrime[l.crime_name] = perCrime[l.crime_name] ?? { attempts: 0, successes: 0 };
    perCrime[l.crime_name].attempts += l.attempts;
    perCrime[l.crime_name].successes += l.successes;
  });

  return (
    <section>
      <h2>Crime Tracker</h2>
      <p className="muted">Log crime attempts and successes to compute pass rates per crime. Owner-only data.</p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>Log crimes</h3>
        <ChoiceInput label="Crime" value={crimeName} onChange={setCrimeName} options={catalogueChoices(choices.data??[],"/torn/crimes","crimes",true)} required/>
        <input className="nu-input" placeholder="Attempts" type="number" min="1" value={attempts} onChange={(e) => setAttempts(e.target.value)} />
        <input className="nu-input" placeholder="Successes" type="number" min="0" value={successes} onChange={(e) => setSuccesses(e.target.value)} />
        <button className="nu-btn" onClick={add}>Log</button>
      </article>
      <div className="grid">
        {Object.entries(perCrime).map(([name, v]) => (
          <article key={name} className="card nu-inset">
            <h3>{name}</h3>
            <p>Pass rate: <strong>{v.attempts > 0 ? Math.round((v.successes / v.attempts) * 100) : 0}%</strong></p>
            <p className="muted">{v.successes}/{v.attempts} successful</p>
          </article>
        ))}
        {Object.keys(perCrime).length === 0 && <p className="muted">No crime logs yet.</p>}
      </div>
    </section>
  );
}
