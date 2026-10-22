import SelectEntry from "../components/SelectEntry";
import ChoiceInput from "../components/ChoiceInput";
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Column { id: string; name: string; unit: string; type: string }
interface Entry { id: string; column_id: string; value: string; recorded_at: string }

export default function CustomStats() {
  const [columns, setColumns] = useState<Column[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [type, setType] = useState('number');
  const [selectedCol, setSelectedCol] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: cols, error: cErr } = await supabase.from('custom_columns').select('*').order('created_at');
    if (cErr) { setError(cErr.message); return; }
    setColumns(cols ?? []);
    const { data: ents, error: eErr } = await supabase.from('custom_entries').select('*').order('recorded_at', { ascending: false }).limit(200);
    if (eErr) { setError(eErr.message); return; }
    setEntries(ents ?? []);
  }

  async function addColumn() {
    setError('');
    if (!name.trim()) { setError('Enter a column name'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('custom_columns').insert({ user_id: user.id, name: name.trim(), unit: unit.trim() || null, type });
    if (error) setError(error.message);
    else { setName(''); setUnit(''); load(); }
  }

  async function addEntry() {
    setError('');
    if (!selectedCol || !value.trim()) { setError('Select a column and enter a value'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('custom_entries').insert({ user_id: user.id, column_id: selectedCol, value: value.trim() });
    if (error) setError(error.message);
    else { setValue(''); load(); }
  }

  async function removeColumn(c: Column) {
    await supabase.from('custom_columns').delete().eq('id', c.id);
    load();
  }

  return (
    <section>
      <h2>Custom Stat Columns</h2>
      <p className="muted">Define your own tracked metrics (e.g. "Daily networth", "Chain hits") and log values over time. All data is owner-only via RLS.</p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>New column</h3>
        <SelectEntry options={["Daily networth","Chain hits","Battle stats","Energy spent"].map(value=>({value,label:value}))} className="nu-input" placeholder="Column name" value={name} onChange={(e) => setName(e.target.value)} />
        <ChoiceInput label="Unit (optional)" value={unit} onChange={setUnit} options={["$","hits","points","count","%","seconds","minutes","days","stats"].map(value=>({value,label:value}))}/>
        <select className="nu-input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="number">Number</option>
          <option value="text">Text</option>
        </select>
        <button className="nu-btn" onClick={addColumn}>Add column</button>
      </article>
      <article className="card nu-inset">
        <h3>Log value</h3>
        <select className="nu-input" value={selectedCol} onChange={(e) => setSelectedCol(e.target.value)}>
          <option value="">Select column…</option>
          {columns.map((c) => <option key={c.id} value={c.id}>{c.name}{c.unit ? ` (${c.unit})` : ''}</option>)}
        </select>
        <SelectEntry key={selectedCol} kind={columns.find(c=>c.id===selectedCol)?.type==='number'?'decimal':undefined} type={columns.find(c=>c.id===selectedCol)?.type==='number'?'number':'text'} step="any" className="nu-input" placeholder="Value" value={value} onChange={(e) => setValue(e.target.value)} options={entries.filter(e=>e.column_id===selectedCol).map(e=>({value:e.value,label:e.value}))}/>
        <button className="nu-btn" onClick={addEntry}>Log</button>
      </article>
      <div className="grid">
        {columns.map((c) => {
          const colEntries = entries.filter((e) => e.column_id === c.id);
          return (
            <article key={c.id} className="card nu-inset">
              <h3>{c.name}{c.unit ? ` (${c.unit})` : ''}</h3>
              <span className="badge">{c.type}</span>
              <p className="muted">{colEntries.length} entries</p>
              <ul>
                {colEntries.slice(0, 5).map((e) => (
                  <li key={e.id}>{e.value} — {new Date(e.recorded_at).toLocaleString()}</li>
                ))}
              </ul>
              <button className="nu-btn" onClick={() => removeColumn(c)}>Delete column</button>
            </article>
          );
        })}
        {columns.length === 0 && <p className="muted">No custom columns yet.</p>}
      </div>
    </section>
  );
}
