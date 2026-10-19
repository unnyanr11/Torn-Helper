import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface GymRow { user_id: string; strength_gain: number; defense_gain: number; speed_gain: number; dexterity_gain: number }
interface RaceRow { user_id: string; track_name: string; best_time_seconds: number }
interface PayoutRow { war_id: string; user_id: string; amount: number }

export default function Leaderboards() {
  const [gym, setGym] = useState<{ user_id: string; total: number }[]>([]);
  const [races, setRaces] = useState<RaceRow[]>([]);
  const [payouts, setPayouts] = useState<{ user_id: string; total: number }[]>([]);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setError('');
    const { data: g, error: gErr } = await supabase.from('gym_sessions').select('user_id, strength_gain, defense_gain, speed_gain, dexterity_gain');
    if (gErr) { setError(gErr.message); return; }
    const gymAgg: Record<string, number> = {};
    (g ?? []).forEach((r: GymRow) => {
      gymAgg[r.user_id] = (gymAgg[r.user_id] ?? 0) + (r.strength_gain ?? 0) + (r.defense_gain ?? 0) + (r.speed_gain ?? 0) + (r.dexterity_gain ?? 0);
    });
    setGym(Object.entries(gymAgg).map(([user_id, total]) => ({ user_id, total })).sort((a, b) => b.total - a.total).slice(0, 10));

    const { data: r, error: rErr } = await supabase.from('race_logs').select('user_id, track_name, best_time_seconds').order('best_time_seconds', { ascending: true }).limit(50);
    if (rErr) { setError(rErr.message); return; }
    const best: Record<string, RaceRow> = {};
    (r ?? []).forEach((row: RaceRow) => {
      const key = `${row.user_id}:${row.track_name}`;
      if (!best[key] || row.best_time_seconds < best[key].best_time_seconds) best[key] = row;
    });
    setRaces(Object.values(best).sort((a, b) => a.best_time_seconds - b.best_time_seconds).slice(0, 10));

    const { data: p, error: pErr } = await supabase.from('payout_lines').select('user_id, amount');
    if (pErr) { setError(pErr.message); return; }
    const payAgg: Record<string, number> = {};
    (p ?? []).forEach((r2: PayoutRow) => {
      payAgg[r2.user_id] = (payAgg[r2.user_id] ?? 0) + (r2.amount ?? 0);
    });
    setPayouts(Object.entries(payAgg).map(([user_id, total]) => ({ user_id, total })).sort((a, b) => b.total - a.total).slice(0, 10));
  }

  return (
    <section>
      <h2>Leaderboards</h2>
      <p className="muted">Rankings computed from your own tracked data (RLS-scoped). Gym ranks total stat gains; racing ranks best time per user per track; payouts rank total allocated amount.</p>
      {error && <p className="badge warn">{error}</p>}
      <div className="grid">
        <article className="card nu-inset">
          <h3>🏋️ Gym — Total Stat Gains</h3>
          <ol>
            {gym.map((r, i) => <li key={r.user_id}>{r.user_id.slice(0, 8)}… — {r.total.toLocaleString()} gains</li>)}
            {gym.length === 0 && <li className="muted">No gym data yet.</li>}
          </ol>
        </article>
        <article className="card nu-inset">
          <h3>🏁 Racing — Best Times</h3>
          <ol>
            {races.map((r, i) => <li key={`${r.user_id}:${r.track_name}`}>{r.user_id.slice(0, 8)}… — {r.track_name}: {r.best_time_seconds}s</li>)}
            {races.length === 0 && <li className="muted">No race data yet.</li>}
          </ol>
        </article>
        <article className="card nu-inset">
          <h3>💰 Payouts — Total Allocated</h3>
          <ol>
            {payouts.map((r, i) => <li key={r.user_id}>{r.user_id.slice(0, 8)}… — ${r.total.toLocaleString()}</li>)}
            {payouts.length === 0 && <li className="muted">No payout data yet.</li>}
          </ol>
        </article>
      </div>
    </section>
  );
}
