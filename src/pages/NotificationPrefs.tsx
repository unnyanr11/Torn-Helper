import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Prefs { email_enabled: boolean; email_address: string; push_enabled: boolean }

export default function NotificationPrefs() {
  const [prefs, setPrefs] = useState<Prefs>({ email_enabled: false, email_address: '', push_enabled: false });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from('notification_preferences').select('*').eq('user_id', user.id).single();
    if (data) setPrefs({ email_enabled: data.email_enabled, email_address: data.email_address ?? '', push_enabled: data.push_enabled });
    if (error && error.code !== 'PGRST116') setError(error.message);
  }

  async function save() {
    setError('');
    setSaved(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('notification_preferences').upsert({
      user_id: user.id,
      email_enabled: prefs.email_enabled,
      email_address: prefs.email_address.trim() || null,
      push_enabled: prefs.push_enabled,
      updated_at: new Date().toISOString(),
    });
    if (error) setError(error.message);
    else setSaved(true);
  }

  return (
    <section>
      <h2>Notification Preferences</h2>
      <p className="muted">Choose how you want to receive alerts. Email delivery requires SMTP setup; push requires VAPID keys. Preferences are stored owner-only.</p>
      {error && <p className="badge warn">{error}</p>}
      {saved && <p className="badge">Preferences saved</p>}
      <article className="card nu-inset">
        <h3>Email</h3>
        <label>
          <input type="checkbox" checked={prefs.email_enabled} onChange={(e) => setPrefs({ ...prefs, email_enabled: e.target.checked })} /> Enable email alerts
        </label>
        <input className="nu-input" placeholder="Email address" type="email" value={prefs.email_address} onChange={(e) => setPrefs({ ...prefs, email_address: e.target.value })} />
      </article>
      <article className="card nu-inset">
        <h3>Web Push</h3>
        <label>
          <input type="checkbox" checked={prefs.push_enabled} onChange={(e) => setPrefs({ ...prefs, push_enabled: e.target.checked })} /> Enable push notifications
        </label>
        <p className="muted">Push requires VAPID key configuration on the server.</p>
      </article>
      <button className="nu-btn" onClick={save}>Save preferences</button>
    </section>
  );
}
