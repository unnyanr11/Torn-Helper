import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Rule {
  id: string;
  name: string;
  condition_type: string;
  enabled: boolean;
}
interface Notification {
  id: string;
  message: string;
  created_at: string;
}

export default function Alerts() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [name, setName] = useState('');
  const [conditionType, setConditionType] = useState('target_available');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const [rulesRes, notifRes] = await Promise.all([
      supabase.from('alert_rules').select('*').order('created_at'),
      supabase.from('notification_events').select('*').order('created_at', { ascending: false }).limit(20),
    ]);
    if (rulesRes.error) setError(rulesRes.error.message);
    else setRules(rulesRes.data ?? []);
    if (notifRes.error) setError(notifRes.error.message);
    else setNotifications(notifRes.data ?? []);
  }

  async function addRule() {
    if (!name.trim()) return;
    const { error } = await supabase.from('alert_rules').insert({ name: name.trim(), condition_type: conditionType });
    if (error) setError(error.message);
    else { setName(''); load(); }
  }

  async function toggleRule(rule: Rule) {
    const { error } = await supabase.from('alert_rules').update({ enabled: !rule.enabled }).eq('id', rule.id);
    if (error) setError(error.message);
    else load();
  }

  async function removeRule(id: string) {
    const { error } = await supabase.from('alert_rules').delete().eq('id', id);
    if (error) setError(error.message);
    else load();
  }

  return (
    <section>
      <h2>Alerts</h2>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>Add alert rule</h3>
        <input className="nu-input" placeholder="Rule name" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="nu-input" value={conditionType} onChange={(e) => setConditionType(e.target.value)}>
          <option value="target_available">Target available</option>
          <option value="energy_threshold">Energy threshold</option>
          <option value="cooldown_expired">Cooldown expired</option>
        </select>
        <button className="nu-btn" onClick={addRule}>Add rule</button>
      </article>
      <div className="grid">
        {rules.map((r) => (
          <article key={r.id} className="card nu-raised">
            <h3>{r.name}</h3>
            <p className="muted">{r.condition_type}</p>
            <div className="meta">
              <button className="nu-btn" onClick={() => toggleRule(r)}>{r.enabled ? '✓ Enabled' : 'Disabled'}</button>
              <button className="nu-btn" onClick={() => removeRule(r.id)}>Remove</button>
            </div>
          </article>
        ))}
        {rules.length === 0 && <p className="muted">No alert rules yet.</p>}
      </div>
      <article className="card nu-inset">
        <h3>Recent notifications</h3>
        <ul>
          {notifications.map((n) => (
            <li key={n.id}>{n.message} <span className="muted">· {new Date(n.created_at).toLocaleString()}</span></li>
          ))}
          {notifications.length === 0 && <li className="muted">No notifications yet.</li>}
        </ul>
      </article>
    </section>
  );
}
