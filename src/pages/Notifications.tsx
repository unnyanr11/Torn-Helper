import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Notification { id: string; title: string; body: string; read: boolean; created_at: string; }

export default function Notifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) setError(error.message);
    else setItems(data ?? []);
  }

  async function markRead(id: string) {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (error) setError(error.message);
    else load();
  }

  async function markAllRead() {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('read', false);
    if (error) setError(error.message);
    else load();
  }

  const unread = items.filter((n) => !n.read).length;

  return (
    <section>
      <h2>Notifications</h2>
      <p className="muted">Alerts fire when a watched target's status matches your condition. The evaluation job runs on a schedule.</p>
      {error && <p className="badge warn">{error}</p>}
      {unread > 0 && <button className="nu-btn" onClick={markAllRead}>Mark all read ({unread})</button>}
      <div className="grid">
        {items.map((n) => (
          <article key={n.id} className={`card ${n.read ? 'nu-inset' : 'nu-raised'}`}>
            <h3>{n.title} {!n.read && <span className="badge warn">new</span>}</h3>
            <p>{n.body}</p>
            <p className="muted">{new Date(n.created_at).toLocaleString()}</p>
            {!n.read && <button className="nu-btn" onClick={() => markRead(n.id)}>Mark read</button>}
          </article>
        ))}
        {items.length === 0 && <p className="muted">No notifications yet.</p>}
      </div>
    </section>
  );
}
