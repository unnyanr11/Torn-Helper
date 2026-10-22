import SelectEntry from "../components/SelectEntry";
import ChoiceInput from "../components/ChoiceInput";
import { useTornChoices } from "../hooks/useTornChoices";
import { catalogueChoices } from "../lib/torn-choices";
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Property { id: string; property_name: string; property_type: string; upkeep: string; rent_income: string; value: string | null; }

export default function Properties() {
  const choices = useTornChoices();
  const [props, setProps] = useState<Property[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState('house');
  const [upkeep, setUpkeep] = useState('');
  const [rent, setRent] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase.from('property_records').select('*').order('created_at');
    if (error) setError(error.message);
    else setProps(data ?? []);
  }

  async function addProperty() {
    if (!name.trim()) { setError('Enter a property name'); return; }
    const { error } = await supabase.from('property_records').insert({
      property_name: name.trim(),
      property_type: type,
      upkeep: upkeep || 0,
      rent_income: rent || 0,
      value: value || null,
    });
    if (error) setError(error.message);
    else { setName(''); setUpkeep(''); setRent(''); setValue(''); load(); }
  }

  async function removeProperty(id: string) {
    const { error } = await supabase.from('property_records').delete().eq('id', id);
    if (error) setError(error.message);
    else load();
  }

  const totalNet = props.reduce((s, p) => s + (parseFloat(p.rent_income) - parseFloat(p.upkeep)), 0);

  return (
    <section>
      <h2>Properties</h2>
      <p className="muted">Manual property tracker. Net shown is rent income minus upkeep per property.</p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>Add property</h3>
        <ChoiceInput label="Property" value={name} onChange={setName} options={catalogueChoices(choices.data??[],"/torn/properties","properties",true)} required/>
        <select className="nu-input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="house">House</option>
          <option value="apartment">Apartment</option>
          <option value="pi">Private Island</option>
          <option value="other">Other</option>
        </select>
        <SelectEntry kind="money" type="number" step="any" className="nu-input" placeholder="Daily upkeep" value={upkeep} onChange={(e) => setUpkeep(e.target.value)} />
        <SelectEntry kind="money" type="number" step="any" className="nu-input" placeholder="Daily rent income" value={rent} onChange={(e) => setRent(e.target.value)} />
        <SelectEntry kind="money" type="number" step="any" className="nu-input" placeholder="Property value (optional)" value={value} onChange={(e) => setValue(e.target.value)} />
        <button className="nu-btn" onClick={addProperty}>Add property</button>
      </article>
      <div className="grid">
        {props.map((p) => (
          <article key={p.id} className="card nu-raised">
            <h3>{p.property_name}</h3>
            <p className="muted">{p.property_type}</p>
            <p className="value">{parseFloat(p.rent_income) - parseFloat(p.upkeep) >= 0 ? '+' : ''}{(parseFloat(p.rent_income) - parseFloat(p.upkeep)).toLocaleString()}</p>
            <p className="muted">Rent {p.rent_income} · Upkeep {p.upkeep}</p>
            <button className="nu-btn" onClick={() => removeProperty(p.id)}>Remove</button>
          </article>
        ))}
        {props.length === 0 && <p className="muted">No properties yet.</p>}
      </div>
      {props.length > 0 && <p className="muted">Total daily net: {totalNet.toLocaleString()}</p>}
    </section>
  );
}
