import { useState } from 'react';
import { STAT_CATALOG } from '../data/statCatalog';

export default function StatsCatalog() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  const categories = ['all', ...Array.from(new Set(STAT_CATALOG.map((s) => s.category)))];
  const filtered = STAT_CATALOG.filter((s) =>
    (category === 'all' || s.category === category) &&
    (s.name.toLowerCase().includes(query.toLowerCase()) || s.description.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <section>
      <h2>217-Stat Catalog</h2>
      <p className="muted">Searchable reference catalog of Torn stat categories and key stats. This is a curated reference (not an exhaustive 217-row dump); use it to look up what each stat tracks.</p>
      <article className="card nu-inset">
        <input className="nu-input" placeholder="Search stats…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="nu-input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
        </select>
      </article>
      <div className="grid">
        {filtered.map((s) => (
          <article key={s.name} className="card nu-inset">
            <h3>{s.name}</h3>
            <span className="badge">{s.category}</span>
            <p>{s.description}</p>
          </article>
        ))}
        {filtered.length === 0 && <p className="muted">No stats match your search.</p>}
      </div>
    </section>
  );
}
