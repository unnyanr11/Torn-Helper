import { useEffect, useState } from 'react';
import { BUILT, NAV, Page } from './nav';
import Overview from './pages/Overview';
import Planner from './pages/Planner';
import Targets from './pages/Targets';
import Alerts from './pages/Alerts';
import Notifications from './pages/Notifications';
import WarRoom from './pages/WarRoom';
import Payouts from './pages/Payouts';
import Losses from './pages/Losses';
import Travel from './pages/Travel';
import Markets from './pages/Markets';
import Stocks from './pages/Stocks';
import Company from './pages/Company';
import Properties from './pages/Properties';
import Racing from './pages/Racing';
import Community from './pages/Community';
import LiveFeeds from './pages/LiveFeeds';
import Estimates from './pages/Estimates';
import Alliances from './pages/Alliances';
import WatchedFactions from './pages/WatchedFactions';
import Recruitment from './pages/Recruitment';
import Gym from './pages/Gym';
import Activity from './pages/Activity';
import Graffiti from './pages/Graffiti';
import Reports from './pages/Reports';
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
        {page === 'Notifications' && <Notifications />}
        {page === 'War Room' && <WarRoom />}
        {page === 'Payouts' && <Payouts />}
        {page === 'Losses' && <Losses />}
        {page === 'Travel' && <Travel />}
        {page === 'Markets' && <Markets />}
        {page === 'Stocks' && <Stocks />}
        {page === 'Company' && <Company />}
        {page === 'Properties' && <Properties />}
        {page === 'Racing' && <Racing />}
        {page === 'Community' && <Community />}
        {page === 'Live Feeds' && <LiveFeeds />}
        {page === 'Estimates' && <Estimates />}
        {page === 'Alliances' && <Alliances />}
        {page === 'Watched Factions' && <WatchedFactions />}
        {page === 'Recruitment' && <Recruitment />}
        {page === 'Gym' && <Gym />}
        {page === 'Activity' && <Activity />}
        {page === 'Graffiti' && <Graffiti />}
        {page === 'Reports' && <Reports />}
        {page === 'API Usage' && <ApiUsage />}
        {!['Overview','Planner','Targets','Alerts','Notifications','War Room','Payouts','Losses','Travel','Markets','Stocks','Company','Properties','Racing','Community','Live Feeds','Estimates','Alliances','Watched Factions','Recruitment','Gym','Activity','Graffiti','Reports','API Usage'].includes(page) && <Placeholder name={page} />}
      </main>
    </div>
  );
}
