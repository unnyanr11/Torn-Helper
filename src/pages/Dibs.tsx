import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Dib { id: string; war_id: string; target_torn_id: number; target_name: string; claimed_until: string; status: string }

export default function Dibs() {
  const [dibs, setDibs] = useState<Dib[]>([]);
  const [targetId, setTargetId] = useState('');
  const [targetName, setTargetName] = useState('');
  const [minutes, setMinutes] = useState('15');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase.from('dibs').select('*').order('claimed_until', { ascending: true }).limit(100);
    if (error) setError(error.message);
    else setDibs(data ?? []);
  }

  async function add() {
    setError('');
    const tid = parseInt(targetId, 10);
    const mins = parseInt(minutes, 10);
    if (isNaN(tid) || isNaN(mins) || mins <= 0) { setError('Enter target ID and claim window (minutes)'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const until = new Date(Date.now() + mins * 60000).toISOString();
    const { error } = await supabase.from('dibs').insert({ user_id: user.id, target_torn_id: tid, target_name: targetName.trim() || null, claimed_until: until });
    if (error) setError(error.message);
    else { setTargetId(''); setTargetName(''); load(); }
  }

  async function markHit(d: Dib) {
    await supabase.from('dibs').update({ status: 'hit' }).eq('id', d.id);
    load();
  }

  async function remove(d: Dib) {
    await supabase.from('dibs').delete().eq('id', d.id);
    load();
  }

  const now = Date.now();

  return (
    <section>
      <h2>Hospital-Timer Dibs</h2>
      <p className="muted">Claim a target before they leave the hospital. Claims expire automatically after the set window.</p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>New dib</h3>
        <input className="nu-input" placeholder="Target Torn ID" value={targetId} onChange={(e) => setTargetId(e.target.value)} />
        <input className="nu-input" placeholder="Target name (optional)" value={targetName} onChange={(e) => setTargetName(e.target.value)} />
        <input className="nu-input" placeholder="Claim window (minutes)" type="number" min="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        <button className="nu-btn" onClick={add}>Claim dib</button>
      </article>
      <div className="grid">
        {dibs.map((d) => {
          const expired = new Date(d.claimed_until).getTime() < now;
          return (
            <article key={d.id} className={`card ${expired ? 'nu-inset' : 'nu-raised'}`}>
              <h3>{d.target_name ?? `Player ${d.target_torn_id}`}</h3>
              <p className="muted">ID: {d.target_torn_id}</p>
              <span className="badge">{expired ? 'expired' : d.status}</span>
              <p className="muted">Until {new Date(d.claimed_until).toLocaleTimeString()}</p>
              <div style={{ display: 'flex', gap: 6 }}>
                {!expired && d.status === 'active' && <button className="nu-btn" onClick={() => markHit(d)}>Mark hit</button>}
                <button className="nu-btn" onClick={() => remove(d)}>Delete</button>
              </div>
            </article>
          );
        })}
        {dibs.length === 0 && <p className="muted">No dibs yet.</p>}
      </div>
    </section>
  );
}
