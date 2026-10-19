import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface ReviveLog { id: string; reviver_torn_id: number; reviver_name: string; target_torn_id: number; target_name: string; revive_type: string; revived_at: string; notes: string }

export default function ReviveTracker() {
  const [logs, setLogs] = useState<ReviveLog[]>([]);
  const [error, setError] = useState('');
  const [rTornId, setRTornId] = useState(''); const [rName, setRName] = useState(''); const [tTornId, setTTornId] = useState(''); const [tName, setTName] = useState(''); const [rType, setRType] = useState('normal'); const [rNotes, setRNotes] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from('revive_logs').select('*').eq('user_id', user.id).order('revived_at', { ascending: false }).limit(100);
    if (error) setError(error.message); else setLogs(data ?? []);
  }

  async function addRevive() {
    setError('');
    const rid = parseInt(rTornId, 10); const tid = parseInt(tTornId, 10);
    if (isNaN(rid) || !rName.trim() || isNaN(tid)) { setError('Fill reviver Torn ID/name and target Torn ID'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('revive_logs').insert({ user_id: user.id, reviver_torn_id: rid, reviver_name: rName.trim(), target_torn_id: tid, target_name: tName.trim() || null, revive_type: rType, notes: rNotes.trim() || null });
    if (error) setError(error.message);
    else { setRTornId(''); setRName(''); setTTornId(''); setTName(''); setRNotes(''); load(); }
  }

  async function removeRevive(id: string) {
    await supabase.from('revive_logs').delete().eq('id', id);
    load();
  }

  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
  const recent = logs.filter((l) => l.revived_at >= cutoff);
  const byReviver: Record<string, number> = {};
  recent.forEach((l) => { byReviver[l.reviver_name] = (byReviver[l.reviver_name] ?? 0) + 1; });
  const topRevivers = Object.entries(byReviver).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <section>
      <h2>Revive Tracker</h2>
      <p className="muted">Log revives given/received to identify reliable revivers and coordinate revive chains during wars.</p>
      {error && <p className="badge warn">{error}</p>}

      <article className="card nu-inset">
        <h3>Top revivers (30d)</h3>
        {topRevivers.map(([name, count]) => (
          <p key={name}>{name}: {count} revive(s)</p>
        ))}
        {topRevivers.length === 0 && <p className="muted">No revives logged in the last 30 days.</p>}
      </article>

      <article className="card nu-inset">
        <h3>Log a revive</h3>
        <input className="nu-input" placeholder="Reviver Torn ID" value={rTornId} onChange={(e) => setRTornId(e.target.value)} />
        <input className="nu-input" placeholder="Reviver name" value={rName} onChange={(e) => setRName(e.target.value)} />
        <input className="nu-input" placeholder="Target Torn ID" value={tTornId} onChange={(e) => setTTornId(e.target.value)} />
        <input className="nu-input" placeholder="Target name (optional)" value={tName} onChange={(e) => setTName(e.target.value)} />
        <select className="nu-input" value={rType} onChange={(e) => setRType(e.target.value)}>
          <option value="normal">Normal</option>
          <option value="medical">Medical</option>
          <option value="event">Event</option>
        </select>
        <input className="nu-input" placeholder="Notes (optional)" value={rNotes} onChange={(e) => setRNotes(e.target.value)} />
        <button className="nu-btn" onClick={addRevive}>Log revive</button>
      </article>

      <article className="card nu-inset">
        <h3>Revive history</h3>
        {logs.map((l) => (
          <div key={l.id} style={{ borderBottom: '1px solid #333', padding: '6px 0', display: 'flex', justifyContent: 'space-between' }}>
            <span>{l.reviver_name} → {l.target_name ?? `#${l.target_torn_id}`} ({l.revive_type}) — {new Date(l.revived_at).toLocaleString()}</span>
            <button className="nu-btn" onClick={() => removeRevive(l.id)}>✕</button>
          </div>
        ))}
        {logs.length === 0 && <p className="muted">No revives logged yet.</p>}
      </article>
    </section>
  );
}
