import { useEffect, useState } from 'react';
import { BUILT, NAV, Page } from './nav';
import Overview from './pages/Overview';
import Placeholder from './pages/Placeholder';

export default function App() {
  const [page, setPage] = useState<Page>('Overview');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="layout">
      <button className="nu-btn menu-btn" aria-label="Toggle navigation" onClick={() => setOpen(!open)}>☰</button>
      <nav className={`sidebar nu-raised ${open ? 'open' : ''}`} aria-label="Main">
        <h1 className="brand">Torn Command Center</h1>
        {NAV.map((n) => (
          <button key={n} className={`nu-btn nav-item ${n === page ? 'active' : ''}`} aria-current={n === page ? 'page' : undefined} onClick={() => { setPage(n); setOpen(false); }}>
            {n}{!BUILT.includes(n) && <span className="tag">soon</span>}
          </button>
        ))}
      </nav>
      <main className="content">
        <header className="topbar nu-raised">
          <span className="badge demo">DEMO MODE – seeded sample data, not live</span>
          <button className="nu-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? 'Light' : 'Dark'} mode
          </button>
        </header>
        {page === 'Overview' ? <Overview /> : <Placeholder name={page} />}
      </main>
    </div>
  );
}
