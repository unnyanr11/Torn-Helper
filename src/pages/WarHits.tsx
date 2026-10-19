import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface War { id: string; name: string }
interface WarHit { id: string; war_id: string; attacker_name: string; target_torn_id: number; hits: number; recorded_at: string }

export default function WarHits() {
  const [wars, setWars] = useState<War[]>([]);
  const [hits, setHits] = useState<WarHit[]>([]);
  const [warId, setWarId] = useState('');
  const [attacker, setAttacker] = useState('');
  const [targetId, setTargetId] = useState('');
  const [hitCount, setHitCount] = useState('1');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setError('');
    const { data: w, error: wErr } = await supabase.from('wars').select('id, name').order('created_at', { ascending: false });
    if (wErr) { setError(wErr.message); return; }
    setWars(w ?? []);
    const { data: h, error: hErr } = await supabase.from('war_hits').select('*').order('recorded_at', { ascending: false }).limit(200);
    if (hErr) { setError(hErr.message); return; }
    setHits(h ?? []);
  }

  async function add() {
    setError('');
    const tid = parseInt(targetId, 10);
    const hc = parseInt(hitCount, 10);
    if (!warId || !attacker.trim() || isNaN(tid) || isNaN(hc) || hc <= 0) { setError('Select war, enter attacker name, target ID, and hit count'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('war_hits').insert({ user_id: user.id, war_id: warId, attacker_name: attacker.trim(), target_torn_id: tid, hits: hc });
    if (error) setError(error.message);
    else { setAttacker(''); setTargetId(''); setHitCount('1'); load(); }
  }

  const perAttacker: Record<string, number> = {};
  hits.filter((h) => !warId || h.war_id === warId).forEach((h) => { perAttacker[h.attacker_name] = (perAttacker[h.attacker_name] ?? 0) + h.hits; });
  const leaderboard = Object.entries(perAttacker).sort((a, b) => b[1] - a[1]);

  return (
    <section>
      <h2>War Hit Counter</h2>
      <p className="muted">Log hits per attacker per war and see a live leaderboard. Owner-only data.</p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>Log hits</h3>
        <select className="nu-input" value={warId} onChange={(e) => setWarId(e.target.value)}>
          <option value="">Select war…</option>
          {wars.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <input className="nu-input" placeholder="Attacker name" value={attacker} onChange={(e) => setAttacker(e.target.value)} />
        <input className="nu-input" placeholder="Target Torn ID" value={targetId} onChange={(e) => setTargetId(e.target.value)} />
        <input className="nu-input" placeholder="Hits" type="number" min="1" value={hitCount} onChange={(e) => setHitCount(e.target.value)} />
        <button className="nu-btn" onClick={add}>Log</button>
      </article>
      <article className="card nu-raised">
        <h3>Leaderboard</h3>
        <ol>
          {leaderboard.map(([name, total]) => <li key={name}>{name} — {total} hits</li>)}
          {leaderboard.length === 0 && <li className="muted">No hits logged yet.</li>}
        </ol>
      </article>
    </section>
  );
}
