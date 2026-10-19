import { useEffect, useState } from 'react';
import { BUILT, NAV, Page } from './nav';
import Overview from './pages/Overview';
import Planner from './pages/Planner';
import Targets from './pages/Targets';
import ComparePlayers from './pages/ComparePlayers';
import Leaderboards from './pages/Leaderboards';
import RoiCalculator from './pages/RoiCalculator';
import PiMortgages from './pages/PiMortgages';
import Bounties from './pages/Bounties';
import StatsCatalog from './pages/StatsCatalog';
import CustomStats from './pages/CustomStats';
import StatIntelligence from './pages/StatIntelligence';
import StatGrowth from './pages/StatGrowth';
import SpyReports from './pages/SpyReports';
import WarHits from './pages/WarHits';
import CrimeTracker from './pages/CrimeTracker';
import FlightTracker from './pages/FlightTracker';
import Dibs from './pages/Dibs';
import TargetPools from './pages/TargetPools';
import Glossary from './pages/Glossary';
import Assistant from './pages/Assistant';
import Discord from './pages/Discord';
import NotificationPrefs from './pages/NotificationPrefs';
import Alerts from './pages/Alerts';
import Notifications from './pages/Notifications';
import WarRoom from './pages/WarRoom';
import WarAnalyzer from './pages/WarAnalyzer';
import PayoutCalculator from './pages/PayoutCalculator';
import LossMarketplace from './pages/LossMarketplace';
import TornStats from './pages/TornStats';
import Travel from './pages/Travel';
import Markets from './pages/Markets';
import Stocks from './pages/Stocks';
import Company from './pages/Company';
import Properties from './pages/Properties';
import Racing from './pages/Racing';
import Community from './pages/Community';
import LiveFeeds from './pages/LiveFeeds';
import Alliances from './pages/Alliances';
import WatchedFactions from './pages/WatchedFactions';
import Recruitment from './pages/Recruitment';
import Gym from './pages/Gym';
import Activity from './pages/Activity';
import Graffiti from './pages/Graffiti';
import Reports from './pages/Reports';
import ApiUsage from './pages/ApiUsage';
import PublicApi from './pages/PublicApi';
import AdminCostDashboard from './pages/AdminCostDashboard';
import CompetitorMatrix from './pages/CompetitorMatrix';
import Halloween from './pages/Halloween';
import FactionOps from './pages/FactionOps';
import FactionFinance from './pages/FactionFinance';
import Placeholder from './pages/Placeholder';

export default function App() {
  const [page, setPage] = useState<Page>('Overview');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
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
        {page === 'Compare Players' && <ComparePlayers />}
        {page === 'Leaderboards' && <Leaderboards />}
        {page === 'ROI Calculator' && <RoiCalculator />}
        {page === 'PI Mortgages' && <PiMortgages />}
        {page === 'Bounties' && <Bounties />}
        {page === 'Stats Catalog' && <StatsCatalog />}
        {page === 'Custom Stats' && <CustomStats />}
        {page === 'Stat Intelligence' && <StatIntelligence />}
        {page === 'Stat Growth' && <StatGrowth />}
        {page === 'Spy Reports' && <SpyReports />}
        {page === 'War Hits' && <WarHits />}
        {page === 'Crime Tracker' && <CrimeTracker />}
        {page === 'Flight Tracker' && <FlightTracker />}
        {page === 'Dibs' && <Dibs />}
        {page === 'Target Pools' && <TargetPools />}
        {page === 'Tornipedia' && <Glossary />}
        {page === 'Assistant' && <Assistant />}
        {page === 'Discord' && <Discord />}
        {page === 'Notification Prefs' && <NotificationPrefs />}
        {page === 'Alerts' && <Alerts />}
        {page === 'Notifications' && <Notifications />}
        {page === 'War Room' && <WarRoom />}
        {page === 'War Analyzer' && <WarAnalyzer />}
        {page === 'Payouts' && <PayoutCalculator />}
        {page === 'Losses' && <LossMarketplace />}
        {page === 'TornStats' && <TornStats />}
        {page === 'Travel' && <Travel />}
        {page === 'Markets' && <Markets />}
        {page === 'Stocks' && <Stocks />}
        {page === 'Company' && <Company />}
        {page === 'Properties' && <Properties />}
        {page === 'Racing' && <Racing />}
        {page === 'Community' && <Community />}
        {page === 'Live Feeds' && <LiveFeeds />}
        {page === 'Alliances' && <Alliances />}
        {page === 'Watched Factions' && <WatchedFactions />}
        {page === 'Recruitment' && <Recruitment />}
        {page === 'Gym' && <Gym />}
        {page === 'Activity' && <Activity />}
        {page === 'Graffiti' && <Graffiti />}
        {page === 'Reports' && <Reports />}
        {page === 'API Usage' && <ApiUsage />}
        {page === 'Public API' && <PublicApi />}
        {page === 'Admin Cost Dashboard' && <AdminCostDashboard />}
        {page === 'Competitor Matrix' && <CompetitorMatrix />}
        {page === 'Halloween' && <Halloween />}
        {page === 'Faction' && <FactionOps />}
        {page === 'Faction Finance' && <FactionFinance />}
        {!['Overview','Planner','Targets','Compare Players','Leaderboards','ROI Calculator','PI Mortgages','Bounties','Stats Catalog','Custom Stats','Stat Intelligence','Stat Growth','Spy Reports','War Hits','Crime Tracker','Flight Tracker','Dibs','Target Pools','Tornipedia','Assistant','Discord','Notification Prefs','Alerts','Notifications','War Room','War Analyzer','Payouts','Losses','TornStats','Travel','Markets','Stocks','Company','Properties','Racing','Community','Live Feeds','Alliances','Watched Factions','Recruitment','Gym','Activity','Graffiti','Reports','API Usage','Public API','Admin Cost Dashboard','Competitor Matrix','Halloween','Faction','Faction Finance'].includes(page) && <Placeholder name={page} />}
      </main>
    </div>
  );
}
