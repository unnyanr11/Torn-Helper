import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Post { id: string; title: string; body: string; category: string; created_at: string; author_user_id: string; }

const CATEGORIES = ['general', 'beginner', 'levelling', 'war', 'market', 'other'];

export default function Community() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [category, setCategory] = useState('general');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase.from('community_posts').select('*').eq('hidden', false).order('created_at', { ascending: false }).limit(50);
    if (error) setError(error.message);
    else setPosts(data ?? []);
  }

  async function addPost() {
    if (!title.trim() || !body.trim()) { setError('Enter a title and body'); return; }
    const { error } = await supabase.from('community_posts').insert({ title: title.trim(), body: body.trim(), category });
    if (error) setError(error.message);
    else { setTitle(''); setBody(''); load(); }
  }

  async function removePost(id: string) {
    const { error } = await supabase.from('community_posts').delete().eq('id', id);
    if (error) setError(error.message);
    else load();
  }

  return (
    <section>
      <h2>Community</h2>
      <p className="muted">Share tips and guides with other users. Posts are public to signed-in users; moderators can hide content.</p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>New post</h3>
        <input className="nu-input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select className="nu-input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <textarea className="nu-input" placeholder="Body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
        <button className="nu-btn" onClick={addPost}>Post</button>
      </article>
      <div className="grid">
        {posts.map((p) => (
          <article key={p.id} className="card nu-raised">
            <h3>{p.title} <span className="badge">{p.category}</span></h3>
            <p>{p.body}</p>
            <p className="muted">{new Date(p.created_at).toLocaleString()}</p>
            <button className="nu-btn" onClick={() => removePost(p.id)}>Delete</button>
          </article>
        ))}
        {posts.length === 0 && <p className="muted">No posts yet.</p>}
      </div>
    </section>
  );
}
