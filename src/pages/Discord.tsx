import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Webhook { id: string; alliance_id: string; webhook_url: string; label: string; enabled: boolean }

export default function Discord() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [allianceId, setAllianceId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase.from('discord_webhooks').select('*').order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setWebhooks(data ?? []);
  }

  async function add() {
    setError('');
    if (!url.trim().startsWith('https://discord.com/api/webhooks/')) { setError('Enter a valid Discord webhook URL'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('discord_webhooks').insert({ user_id: user.id, webhook_url: url.trim(), label: label.trim() || null, alliance_id: allianceId.trim() || null });
    if (error) setError(error.message);
    else { setUrl(''); setLabel(''); setAllianceId(''); load(); }
  }

  async function sendTest(w: Webhook) {
    setError('');
    const res = await fetch(w.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message.trim() || 'Test message from Torn Command Center' }),
    });
    if (!res.ok) setError(`Discord returned ${res.status}`);
    else setMessage('');
  }

  async function remove(w: Webhook) {
    await supabase.from('discord_webhooks').delete().eq('id', w.id);
    load();
  }

  return (
    <section>
      <h2>Discord Integration</h2>
      <p className="muted">Add Discord webhooks to send messages (alerts, war updates, graffiti broadcasts) to your Discord channels. Webhook URLs are stored owner-only.</p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>Add webhook</h3>
        <input className="nu-input" placeholder="Discord webhook URL" value={url} onChange={(e) => setUrl(e.target.value)} />
        <input className="nu-input" placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input className="nu-input" placeholder="Alliance ID (optional)" value={allianceId} onChange={(e) => setAllianceId(e.target.value)} />
        <button className="nu-btn" onClick={add}>Add webhook</button>
      </article>
      <article className="card nu-inset">
        <h3>Send message</h3>
        <textarea className="nu-input" rows={2} placeholder="Message to send to all enabled webhooks" value={message} onChange={(e) => setMessage(e.target.value)} />
      </article>
      <div className="grid">
        {webhooks.map((w) => (
          <article key={w.id} className="card nu-inset">
            <h3>{w.label ?? 'Webhook'}</h3>
            <p className="muted">{w.webhook_url.slice(0, 40)}…</p>
            <span className="badge">{w.enabled ? 'enabled' : 'disabled'}</span>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button className="nu-btn" onClick={() => sendTest(w)}>Send</button>
              <button className="nu-btn" onClick={() => remove(w)}>Delete</button>
            </div>
          </article>
        ))}
        {webhooks.length === 0 && <p className="muted">No webhooks yet.</p>}
      </div>
    </section>
  );
}
