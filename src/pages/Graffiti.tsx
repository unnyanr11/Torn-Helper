import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Post { id: string; alliance_id: string; author_user_id: string; body: string; pinned: boolean; hidden: boolean; created_at: string; }
interface Reaction { id: string; post_id: string; emoji: string; }

const EMOJIS = ['👍', '👎', '❤️', '😂', '😮'];

export default function Graffiti() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [allianceId, setAllianceId] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: p, error: pErr } = await supabase.from('graffiti_posts').select('*').eq('hidden', false).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(100);
    if (pErr) setError(pErr.message);
    else setPosts(p ?? []);
    const { data: r, error: rErr } = await supabase.from('graffiti_reactions').select('*');
    if (rErr) setError(rErr.message);
    else setReactions(r ?? []);
  }

  async function setAlliance(id: string) {
    setAllianceId(id);
    await load();
  }

  async function post() {
    if (!allianceId || !body.trim()) { setError('Select an alliance and enter a message'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('graffiti_posts').insert({ alliance_id: allianceId, author_user_id: user.id, body: body.trim().slice(0, 500) });
    if (error) setError(error.message);
    else { setBody(''); load(); }
  }

  async function react(postId: string, emoji: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const existing = reactions.find((r) => r.post_id === postId && r.emoji === emoji);
    if (existing) {
      await supabase.from('graffiti_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('graffiti_reactions').insert({ post_id: postId, user_id: user.id, emoji });
    }
    load();
  }

  async function togglePin(p: Post) {
    await supabase.from('graffiti_posts').update({ pinned: !p.pinned }).eq('id', p.id);
    load();
  }

  async function hide(p: Post) {
    await supabase.from('graffiti_posts').update({ hidden: true }).eq('id', p.id);
    load();
  }

  async function remove(p: Post) {
    await supabase.from('graffiti_posts').delete().eq('id', p.id);
    load();
  }

  return (
    <section>
      <h2>Graffiti Wall</h2>
      <p className="muted">Short text posts (max 500 chars) scoped to your alliance. Officers can pin or hide; authors can delete their own posts.</p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>Alliance ID</h3>
        <input className="nu-input" placeholder="Alliance ID" value={allianceId} onChange={(e) => setAlliance(e.target.value)} />
      </article>
      <article className="card nu-inset">
        <h3>New post</h3>
        <textarea className="nu-input" placeholder="Message (max 500 chars)" value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={500} />
        <button className="nu-btn" onClick={post}>Post</button>
      </article>
      <div className="grid">
        {posts.map((p) => {
          const counts: Record<string, number> = {};
          reactions.filter((r) => r.post_id === p.id).forEach((r) => { counts[r.emoji] = (counts[r.emoji] ?? 0) + 1; });
          return (
            <article key={p.id} className={`card ${p.pinned ? 'nu-raised' : 'nu-inset'}`}>
              {p.pinned && <span className="badge">📌 pinned</span>}
              <p>{p.body}</p>
              <p className="muted">{new Date(p.created_at).toLocaleString()}</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {EMOJIS.map((e) => (
                  <button key={e} className="nu-btn" onClick={() => react(p.id, e)}>{e} {counts[e] ?? 0}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button className="nu-btn" onClick={() => togglePin(p)}>{p.pinned ? 'Unpin' : 'Pin'}</button>
                <button className="nu-btn" onClick={() => hide(p)}>Hide</button>
                <button className="nu-btn" onClick={() => remove(p)}>Delete</button>
              </div>
            </article>
          );
        })}
        {posts.length === 0 && <p className="muted">No posts yet.</p>}
      </div>
    </section>
  );
}
