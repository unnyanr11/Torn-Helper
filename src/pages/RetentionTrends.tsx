import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface MembershipEvent { id: string; member_torn_id: number; member_name: string; event_type: string; event_date: string; notes: string }

export default function RetentionTrends() {
  const [events, setEvents] = useState<MembershipEvent[]>([]);
  const [error, setError] = useState('');
  const [mTornId, setMTornId] = useState(''); const [mName, setMName] = useState(''); const [mType, setMType] = useState('joined'); const [mDate, setMDate] = useState(''); const [mNotes, setMNotes] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from('faction_membership_events').select('*').eq('user_id', user.id).order('event_date', { ascending: false }).limit(200);
    if (error) setError(error.message); else setEvents(data ?? []);
  }

  async function addEvent() {
    setError('');
    const tid = parseInt(mTornId, 10);
    if (isNaN(tid) || !mName.trim() || !mDate) { setError('Fill Torn ID, name, and date'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('faction_membership_events').insert({ user_id: user.id, member_torn_id: tid, member_name: mName.trim(), event_type: mType, event_date: mDate, notes: mNotes.trim() || null });
    if (error) setError(error.message);
    else { setMTornId(''); setMName(''); setMDate(''); setMNotes(''); load(); }
  }

  async function removeEvent(id: string) {
    await supabase.from('faction_membership_events').delete().eq('id', id);
    load();
  }

  // Retention: joined minus (left + kicked) over trailing 30 days
  const now = new Date();
  const cutoff = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const recent = events.filter((e) => e.event_date >= cutoff);
  const joined = recent.filter((e) => e.event_type === 'joined').length;
  const left = recent.filter((e) => e.event_type === 'left').length;
  const kicked = recent.filter((e) => e.event_type === 'kicked').length;
  const netChange = joined - left - kicked;
  const retentionRate = joined > 0 ? Math.round(((joined - left - kicked) / joined) * 100) : 0;

  // Monthly breakdown (last 6 months)
  const monthly: Record<string, { joined: number; left: number; kicked: number }> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthly[key] = { joined: 0, left: 0, kicked: 0 };
  }
  events.forEach((e) => {
    const key = e.event_date.slice(0, 7);
    if (monthly[key]) monthly[key][e.event_type as 'joined' | 'left' | 'kicked']++;
  });

  return (
    <section>
      <h2>Retention Trends</h2>
      <p className="muted">Track member join/leave/kick events and view retention over time.</p>
      {error && <p className="badge warn">{error}</p>}

      <div className="grid">
        <article className="card nu-inset">
          <h3>Last 30 days</h3>
          <p>Joined: {joined} • Left: {left} • Kicked: {kicked}</p>
          <p><b>Net change:</b> {netChange >= 0 ? '+' : ''}{netChange}</p>
          <p><b>Retention rate:</b> {retentionRate}%</p>
        </article>
        <article className="card nu-inset">
          <h3>Monthly breakdown (6 mo)</h3>
          {Object.entries(monthly).map(([month, m]) => (
            <p key={month}>{month}: +{m.joined} / -{m.left} / kicked {m.kicked}</p>
          ))}
        </article>
      </div>

      <article className="card nu-inset">
        <h3>Log membership event</h3>
        <input className="nu-input" placeholder="Member Torn ID" value={mTornId} onChange={(e) => setMTornId(e.target.value)} />
        <input className="nu-input" placeholder="Member name" value={mName} onChange={(e) => setMName(e.target.value)} />
        <select className="nu-input" value={mType} onChange={(e) => setMType(e.target.value)}>
          <option value="joined">Joined</option>
          <option value="left">Left</option>
          <option value="kicked">Kicked</option>
        </select>
        <input className="nu-input" type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} />
        <input className="nu-input" placeholder="Notes (optional)" value={mNotes} onChange={(e) => setMNotes(e.target.value)} />
        <button className="nu-btn" onClick={addEvent}>Log event</button>
      </article>

      <article className="card nu-inset">
        <h3>Event history</h3>
        {events.map((e) => (
          <div key={e.id} style={{ borderBottom: '1px solid #333', padding: '6px 0', display: 'flex', justifyContent: 'space-between' }}>
            <span>{e.event_date} — {e.member_name} (#{e.member_torn_id}) — {e.event_type}{e.notes ? ` — ${e.notes}` : ''}</span>
            <button className="nu-btn" onClick={() => removeEvent(e.id)}>✕</button>
          </div>
        ))}
        {events.length === 0 && <p className="muted">No events logged yet.</p>}
      </article>
    </section>
  );
}
