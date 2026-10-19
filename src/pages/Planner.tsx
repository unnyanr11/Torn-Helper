import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Goal {
  id: string;
  title: string;
  kind: string;
  target_value: number | null;
  current_value: number | null;
  done: boolean;
}

export default function Planner() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('levelling');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase.from('goals').select('*').order('created_at');
    if (error) setError(error.message);
    else setGoals(data ?? []);
  }

  async function addGoal() {
    if (!title.trim()) return;
    const { error } = await supabase.from('goals').insert({ title: title.trim(), kind });
    if (error) setError(error.message);
    else { setTitle(''); load(); }
  }

  async function toggleDone(goal: Goal) {
    const { error } = await supabase.from('goals').update({ done: !goal.done }).eq('id', goal.id);
    if (error) setError(error.message);
    else load();
  }

  async function removeGoal(id: string) {
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (error) setError(error.message);
    else load();
  }

  return (
    <section>
      <h2>Planner</h2>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>Add goal</h3>
        <input className="nu-input" placeholder="Goal title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select className="nu-input" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="levelling">Levelling</option>
          <option value="money">Money</option>
          <option value="training">Training</option>
          <option value="custom">Custom</option>
        </select>
        <button className="nu-btn" onClick={addGoal}>Add</button>
      </article>
      <div className="grid">
        {goals.map((g) => (
          <article key={g.id} className="card nu-raised">
            <h3>{g.title}</h3>
            <p className="muted">{g.kind}{g.target_value != null && ` · target ${g.target_value}`}</p>
            <div className="meta">
              <button className="nu-btn" onClick={() => toggleDone(g)}>{g.done ? '✓ Done' : 'Mark done'}</button>
              <button className="nu-btn" onClick={() => removeGoal(g.id)}>Remove</button>
            </div>
          </article>
        ))}
        {goals.length === 0 && <p className="muted">No goals yet. Add one above.</p>}
      </div>
    </section>
  );
}
