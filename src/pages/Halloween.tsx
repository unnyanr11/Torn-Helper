import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface CandyLog { id: string; candy_type: string; count: number; source: string; created_at: string }

const NPC_SPAWNS = [
  { name: 'Pumpkin Head', interval: 'every 30 min', nextOffsetMin: 15 },
  { name: 'Ghost', interval: 'every 45 min', nextOffsetMin: 30 },
  { name: 'Skeleton Crew', interval: 'every 60 min', nextOffsetMin: 45 },
];

export default function Halloween() {
  const [logs, setLogs] = useState<CandyLog[]>([]);
  const [candyType, setCandyType] = useState('candy');
  const [count, setCount] = useState('1');
  const [source, setSource] = useState('trick-or-treat');
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from('halloween_candy_log').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
    if (error) setError(error.message); else setLogs(data ?? []);
  }

  async function addLog() {
    setError('');
    const c = parseInt(count, 10);
    if (isNaN(c) || c < 0) { setError('Enter a valid count'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('halloween_candy_log').insert({ user_id: user.id, candy_type: candyType, count: c, source });
    if (error) setError(error.message);
    else { setCount('1'); load(); }
  }

  async function removeLog(id: string) {
    await supabase.from('halloween_candy_log').delete().eq('id', id);
    load();
  }

  const totals = logs.reduce((acc: Record<string, number>, l) => { acc[l.candy_type] = (acc[l.candy_type] ?? 0) + l.count; return acc; }, {});
  const grandTotal = Object.values(totals).reduce((a: number, b) => a + b, 0);

  return (
    <section>
      <h2>Halloween Tools</h2>
      <p className="muted">Seasonal event tracker: log candy/plushie/flower hauls, see totals by type, and check NPC spawn timers.</p>
      {error && <p className="badge warn">{error}</p>}

      <article className="card nu-inset">
        <h3>Log a haul</h3>
        <select className="nu-input" value={candyType} onChange={(e) => setCandyType(e.target.value)}>
          <option value="candy">Candy</option>
          <option value="chocolate">Chocolate</option>
          <option value="plushie">Plushie</option>
          <option value="flower">Flower</option>
          <option value="other">Other</option>
        </select>
        <input className="nu-input" type="number" min="0" placeholder="Count" value={count} onChange={(e) => setCount(e.target.value)} />
        <input className="nu-input" placeholder="Source (e.g. trick-or-treat, NPC)" value={source} onChange={(e) => setSource(e.target.value)} />
        <button className="nu-btn" onClick={addLog}>Add haul</button>
      </article>

      <article className="card nu-inset">
        <h3>Totals</h3>
        <p><b>Grand total:</b> {grandTotal}</p>
        {Object.entries(totals).map(([type, n]) => (
          <p key={type}>{type}: {n}</p>
        ))}
        {grandTotal === 0 && <p className="muted">No hauls logged yet.</p>}
      </article>

      <article className="card nu-inset">
        <h3>NPC spawn timers</h3>
        {NPC_SPAWNS.map((npc) => {
          const minutesPast = (now / 60000) % parseInt(npc.interval.match(/\d+/)![0]);
          const remaining = Math.max(0, Math.round(parseInt(npc.interval.match(/\d+/)![0]) - ((minutesPast + npc.nextOffsetMin) % parseInt(npc.interval.match(/\d+/)![0]))));
          return (
            <p key={npc.name}><b>{npc.name}</b> — {npc.interval} — approx {remaining} min until next spawn</p>
          );
        })}
        <p className="muted" style={{ marginTop: 6 }}>Timers are approximate and based on observed community patterns; verify in-game.</p>
      </article>

      <article className="card nu-inset">
        <h3>Recent hauls</h3>
        {logs.map((l) => (
          <div key={l.id} style={{ borderBottom: '1px solid #333', padding: '6px 0', display: 'flex', justifyContent: 'space-between' }}>
            <span>{l.count}x {l.candy_type} ({l.source}) — {new Date(l.created_at).toLocaleString()}</span>
            <button className="nu-btn" onClick={() => removeLog(l.id)}>✕</button>
          </div>
        ))}
        {logs.length === 0 && <p className="muted">No hauls yet.</p>}
      </article>
    </section>
  );
}
