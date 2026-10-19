import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Grant { id: string; alliance_name: string; resource_type: string; resource_id: string; granted_to_role: string; status: string; created_at: string; revoked_at: string }

export default function AllianceSharing() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [error, setError] = useState('');
  const [alliance, setAlliance] = useState(''); const [resType, setResType] = useState('target_list'); const [resId, setResId] = useState(''); const [role, setRole] = useState('member');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from('alliance_sharing_grants').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
    if (error) setError(error.message); else setGrants(data ?? []);
  }

  async function createGrant() {
    setError('');
    if (!alliance.trim()) { setError('Enter alliance name'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('alliance_sharing_grants').insert({ user_id: user.id, alliance_name: alliance.trim(), resource_type: resType, resource_id: resId.trim() || null, granted_to_role: role });
    if (error) setError(error.message);
    else { setAlliance(''); setResId(''); load(); }
  }

  async function revokeGrant(id: string) {
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('alliance_sharing_grants').update({ status: 'revoked', revoked_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id);
    if (error) setError(error.message);
    else load();
  }

  async function reactivateGrant(id: string) {
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('alliance_sharing_grants').update({ status: 'active', revoked_at: null }).eq('id', id).eq('user_id', user.id);
    if (error) setError(error.message);
    else load();
  }

  const active = grants.filter((g) => g.status === 'active');
  const revoked = grants.filter((g) => g.status === 'revoked');

  return (
    <section>
      <h2>Alliance Sharing</h2>
      <p className="muted">Grant scoped access to alliance/sister-faction resources (target lists, spy reports, war reports, ledger) by role. Revoke instantly; revoked grants stop applying immediately.</p>
      {error && <p className="badge warn">{error}</p>}

      <article className="card nu-inset">
        <h3>Create sharing grant</h3>
        <input className="nu-input" placeholder="Alliance / sister-faction name" value={alliance} onChange={(e) => setAlliance(e.target.value)} />
        <select className="nu-input" value={resType} onChange={(e) => setResType(e.target.value)}>
          <option value="target_list">Target list</option>
          <option value="spy_report">Spy report</option>
          <option value="war_report">War report</option>
          <option value="ledger">Ledger</option>
          <option value="custom">Custom</option>
        </select>
        <input className="nu-input" placeholder="Resource ID (optional)" value={resId} onChange={(e) => setResId(e.target.value)} />
        <select className="nu-input" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="member">Member</option>
          <option value="officer">Officer</option>
          <option value="leader">Leader</option>
        </select>
        <button className="nu-btn" onClick={createGrant}>Create grant</button>
      </article>

      <article className="card nu-inset">
        <h3>Active grants ({active.length})</h3>
        {active.map((g) => (
          <div key={g.id} style={{ borderBottom: '1px solid #333', padding: '6px 0', display: 'flex', justifyContent: 'space-between' }}>
            <span>{g.alliance_name} — {g.resource_type} → {g.granted_to_role} (since {new Date(g.created_at).toLocaleDateString()})</span>
            <button className="nu-btn" onClick={() => revokeGrant(g.id)}>Revoke</button>
          </div>
        ))}
        {active.length === 0 && <p className="muted">No active grants.</p>}
      </article>

      <article className="card nu-inset">
        <h3>Revoked grants ({revoked.length})</h3>
        {revoked.map((g) => (
          <div key={g.id} style={{ borderBottom: '1px solid #333', padding: '6px 0', display: 'flex', justifyContent: 'space-between' }}>
            <span>{g.alliance_name} — {g.resource_type} → {g.granted_to_role} (revoked {g.revoked_at ? new Date(g.revoked_at).toLocaleDateString() : '—'})</span>
            <button className="nu-btn" onClick={() => reactivateGrant(g.id)}>Reactivate</button>
          </div>
        ))}
        {revoked.length === 0 && <p className="muted">No revoked grants.</p>}
      </article>
    </section>
  );
}
