import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Alliance { id: string; name: string; tag: string | null; }
interface Member { id: string; user_id: string; role: string; joined_at: string; }
interface Announcement { id: string; title: string; body: string; created_at: string; }
interface Invitation { id: string; alliance_id: string; status: string; }

export default function Alliances() {
  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [newName, setNewName] = useState('');
  const [newTag, setNewTag] = useState('');
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: a, error: aErr } = await supabase.from('alliances').select('*');
    if (aErr) setError(aErr.message);
    else setAlliances(a ?? []);
    if (activeId) await loadAlliance(activeId);
  }

  async function loadAlliance(id: string) {
    setActiveId(id);
    const [m, a, i] = await Promise.all([
      supabase.from('alliance_members').select('*').eq('alliance_id', id),
      supabase.from('alliance_announcements').select('*').eq('alliance_id', id).order('created_at', { ascending: false }),
      supabase.from('alliance_invitations').select('*').eq('alliance_id', id),
    ]);
    if (m.error) setError(m.error.message); else setMembers(m.data ?? []);
    if (a.error) setError(a.error.message); else setAnnouncements(a.data ?? []);
    if (i.error) setError(i.error.message); else setInvitations(i.data ?? []);
  }

  async function createAlliance() {
    if (!newName.trim()) { setError('Enter an alliance name'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Not signed in'); return; }
    const { data, error } = await supabase.from('alliances').insert({ name: newName.trim(), tag: newTag.trim() || null, created_by: user.id }).select().single();
    if (error) { setError(error.message); return; }
    await supabase.from('alliance_members').insert({ alliance_id: data.id, user_id: user.id, role: 'leader' });
    setNewName(''); setNewTag('');
    load();
  }

  async function postAnnouncement() {
    if (!activeId || !annTitle.trim() || !annBody.trim()) { setError('Enter title and body'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('alliance_announcements').insert({ alliance_id: activeId, author_user_id: user.id, title: annTitle.trim(), body: annBody.trim() });
    if (error) setError(error.message);
    else { setAnnTitle(''); setAnnBody(''); loadAlliance(activeId); }
  }

  async function inviteMember(inviteeId: string) {
    if (!activeId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('alliance_invitations').insert({ alliance_id: activeId, inviter_user_id: user.id, invitee_user_id: inviteeId });
    if (error) setError(error.message);
    else loadAlliance(activeId);
  }

  return (
    <section>
      <h2>Alliances & Families</h2>
      <p className="muted">Group alliances, manage members and roles, post announcements, and invite users. Access is scoped to alliance members.</p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>Create alliance</h3>
        <input className="nu-input" placeholder="Alliance name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <input className="nu-input" placeholder="Tag (optional)" value={newTag} onChange={(e) => setNewTag(e.target.value)} />
        <button className="nu-btn" onClick={createAlliance}>Create</button>
      </article>
      <article className="card nu-raised">
        <h3>Your alliances</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {alliances.map((a) => (
            <button key={a.id} className="nu-btn" onClick={() => loadAlliance(a.id)}>
              {a.name}{a.tag ? ` [${a.tag}]` : ''}
            </button>
          ))}
          {alliances.length === 0 && <p className="muted">No alliances yet.</p>}
        </div>
      </article>
      {activeId && (
        <>
          <article className="card nu-raised">
            <h3>Members ({members.length})</h3>
            <table>
              <thead><tr><th>Role</th><th>Joined</th></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}><td className="capitalize">{m.role}</td><td>{new Date(m.joined_at).toLocaleDateString()}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="muted">Invite by user ID via the invitation flow (officer/leader only).</p>
          </article>
          <article className="card nu-inset">
            <h3>New announcement</h3>
            <input className="nu-input" placeholder="Title" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} />
            <textarea className="nu-input" placeholder="Body" value={annBody} onChange={(e) => setAnnBody(e.target.value)} rows={3} />
            <button className="nu-btn" onClick={postAnnouncement}>Post</button>
          </article>
          <article className="card nu-raised">
            <h3>Announcements</h3>
            {announcements.map((a) => (
              <div key={a.id} style={{ marginBottom: 12 }}>
                <strong>{a.title}</strong>
                <p>{a.body}</p>
                <p className="muted">{new Date(a.created_at).toLocaleString()}</p>
              </div>
            ))}
            {announcements.length === 0 && <p className="muted">No announcements.</p>}
          </article>
          <article className="card nu-raised">
            <h3>Invitations ({invitations.filter((i) => i.status === 'pending').length} pending)</h3>
            {invitations.map((i) => (
              <p key={i.id} className="muted">Invitation {i.id.slice(0, 8)}… — {i.status}</p>
            ))}
            {invitations.length === 0 && <p className="muted">No invitations.</p>}
          </article>
        </>
      )}
    </section>
  );
}
