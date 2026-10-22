import SelectEntry from "../components/SelectEntry";
import { useState } from 'react';
import { GLOSSARY } from '../data/glossary';

export default function Glossary() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  const categories = ['all', ...Array.from(new Set(GLOSSARY.map((g) => g.category)))];
  const filtered = GLOSSARY.filter((g) =>
    (category === 'all' || g.category === category) &&
    (g.term.toLowerCase().includes(query.toLowerCase()) || g.definition.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <section>
      <h2>Tornipedia</h2>
      <p className="muted">Searchable glossary of Torn terms and mechanics. Static reference, no external APIs.</p>
      <article className="card nu-inset">
        <SelectEntry label="Term" value={query} onChange={e=>setQuery(e.target.value)} options={GLOSSARY.filter(g=>category==='all'||g.category===category).map(g=>({value:g.term,label:g.term}))} emptyText="All terms"/>
        <select className="nu-input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
        </select>
      </article>
      <div className="grid">
        {filtered.map((g) => (
          <article key={g.term} className="card nu-inset">
            <h3>{g.term}</h3>
            <span className="badge">{g.category}</span>
            <p>{g.definition}</p>
          </article>
        ))}
        {filtered.length === 0 && <p className="muted">No terms match your search.</p>}
      </div>
    </section>
  );
}
