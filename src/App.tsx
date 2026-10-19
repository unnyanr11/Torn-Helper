import { useEffect, useState } from 'react';
import { BUILT, NAV, Page } from './nav';
import Overview from './pages/Overview';
import Planner from './pages/Planner';
import Targets from './pages/Targets';
import Alerts from './pages/Alerts';
import WarRoom from './pages/WarRoom';
import Payouts from './pages/Payouts';
import Losses from './pages/Losses';
import ApiUsage from './pages/ApiUsage';
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
        {page === 'Overview' && <Overview />}
        {page === 'Planner' && <Planner />}
        {page === 'Targets' && <Targets />}
        {page === 'Alerts' && <Alerts />}
        {page === 'War Room' && <WarRoom />}
        {page === 'Payouts' && <Payouts />}
        {page === 'Losses' && <Losses />}
        {page === 'API Usage' && <ApiUsage />}
        {!['Overview','Planner','Targets','Alerts','War Room','Payouts','Losses','API Usage'].includes(page) && <Placeholder name={page} />}
      </main>
    </div>
  );
}
