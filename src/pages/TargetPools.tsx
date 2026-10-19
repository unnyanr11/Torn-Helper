import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Pool { id: string; name: string; description: string; target_torn_ids: number[] }

export default function TargetPools() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ids, setIds] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase.from('target_pools').select('*').order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setPools(data ?? []);
  }

  async function add() {
    setError('');
    if (!name.trim()) { setError('Enter a pool name'); return; }
    const parsed = ids.split(/[\s,]+/).map((s) => parseInt(s, 10)).filter((n) => !isNaN(n) && n > 0);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('target_pools').insert({ user_id: user.id, name: name.trim(), description: description.trim() || null, target_torn_ids: parsed });
    if (error) setError(error.message);
    else { setName(''); setDescription(''); setIds(''); load(); }
  }

  async function remove(p: Pool) {
    await supabase.from('target_pools').delete().eq('id', p.id);
    load();
  }

  return (
    <section>
      <h2>Target Pools</h2>
      <p className="muted">Create curated lists of targets (e.g. inactive chain targets, low-stat farms). Owner-only data.</p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>New pool</h3>
        <input className="nu-input" placeholder="Pool name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="nu-input" placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <input className="nu-input" placeholder="Target IDs (comma separated)" value={ids} onChange={(e) => setIds(e.target.value)} />
        <button className="nu-btn" onClick={add}>Create pool</button>
      </article>
      <div className="grid">
        {pools.map((p) => (
          <article key={p.id} className="card nu-inset">
            <h3>{p.name}</h3>
            {p.description && <p>{p.description}</p>}
            <p className="muted">{p.target_torn_ids.length} targets</p>
            <p>{p.target_torn_ids.slice(0, 10).join(', ')}{p.target_torn_ids.length > 10 ? '…' : ''}</p>
            <button className="nu-btn" onClick={() => remove(p)}>Delete</button>
          </article>
        ))}
        {pools.length === 0 && <p className="muted">No pools yet.</p>}
      </div>
    </section>
  );
}
