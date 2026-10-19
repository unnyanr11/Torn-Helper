import { useEffect, useState } from 'react';
import { STATS_CATALOG, STAT_CATEGORIES, VERIFIED_METRIC_COUNT } from '../data/statsCatalog';

export default function StatsCatalog() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [favourites, setFavourites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('tcc_stat_favs') ?? '[]'); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('tcc_stat_favs', JSON.stringify(favourites));
  }, [favourites]);

  const filtered = STATS_CATALOG.filter((s) =>
    (category === 'all' || s.category === category) &&
    (s.name.toLowerCase().includes(query.toLowerCase()) || s.description.toLowerCase().includes(query.toLowerCase()))
  );

  function toggleFav(id: string) {
    setFavourites((f) => f.includes(id) ? f.filter((x) => x !== id) : [...f, id]);
  }

  return (
    <section>
      <h2>Stats Catalog</h2>
      <p className="muted">Searchable catalog of {VERIFIED_METRIC_COUNT} verified distinct metrics across {STAT_CATEGORIES.length} categories. Favourites persist locally. Each metric shows unit, source, and description.</p>
      <p className="badge">{VERIFIED_METRIC_COUNT} / 217+ target metrics verified</p>
      <article className="card nu-inset">
        <input className="nu-input" placeholder="Search metrics…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="nu-input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {STAT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </article>
      <div className="grid">
        {filtered.map((s) => (
          <article key={s.id} className={`card ${favourites.includes(s.id) ? 'nu-raised' : 'nu-inset'}`} title={s.description}>
            <h3>{s.name} <button className="nu-btn" onClick={() => toggleFav(s.id)} style={{ marginLeft: 6, padding: '2px 6px' }}>{favourites.includes(s.id) ? '★' : '☆'}</button></h3>
            <span className="badge">{s.category}</span>
            <span className="badge" style={{ marginLeft: 4 }}>{s.unit}</span>
            <span className="badge" style={{ marginLeft: 4 }}>{s.source}</span>
            <p>{s.description}</p>
          </article>
        ))}
        {filtered.length === 0 && <p className="muted">No metrics match your search.</p>}
      </div>
    </section>
  );
}
