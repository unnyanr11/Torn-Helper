import SpatialShell from "./components/SpatialShell";
import TornDataShortcut from "./components/TornDataShortcut";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { NAV, Page } from "./nav";
const Overview = lazy(() => import("./pages/Overview"));
const Planner = lazy(() => import("./pages/Planner"));
const Targets = lazy(() => import("./pages/Targets"));
const ComparePlayers = lazy(() => import("./pages/ComparePlayers"));
const Leaderboards = lazy(() => import("./pages/Leaderboards"));
const RoiCalculator = lazy(() => import("./pages/RoiCalculator"));
const PiMortgages = lazy(() => import("./pages/PiMortgages"));
const Bounties = lazy(() => import("./pages/Bounties"));
const StatsCatalog = lazy(() => import("./pages/StatsCatalog"));
const CustomStats = lazy(() => import("./pages/CustomStats"));
const StatIntelligence = lazy(() => import("./pages/StatIntelligence"));
const StatGrowth = lazy(() => import("./pages/StatGrowth"));
const SpyReports = lazy(() => import("./pages/SpyReports"));
const WarHits = lazy(() => import("./pages/WarHits"));
const CrimeTracker = lazy(() => import("./pages/CrimeTracker"));
const FlightTracker = lazy(() => import("./pages/FlightTracker"));
const Dibs = lazy(() => import("./pages/Dibs"));
const TargetPools = lazy(() => import("./pages/TargetPools"));
const Glossary = lazy(() => import("./pages/Glossary"));
const Assistant = lazy(() => import("./pages/Assistant"));
const Discord = lazy(() => import("./pages/Discord"));
const NotificationPrefs = lazy(() => import("./pages/NotificationPrefs"));
const Alerts = lazy(() => import("./pages/Alerts"));
const Notifications = lazy(() => import("./pages/Notifications"));
const WarRoom = lazy(() => import("./pages/WarRoom"));
const WarAnalyzer = lazy(() => import("./pages/WarAnalyzer"));
const AiWarAnalyzer = lazy(() => import("./pages/AiWarAnalyzer"));
const PayoutCalculator = lazy(() => import("./pages/PayoutCalculator"));
const LossMarketplace = lazy(() => import("./pages/LossMarketplace"));
const TornStats = lazy(() => import("./pages/TornStats"));
const Travel = lazy(() => import("./pages/Travel"));
const TravelOptimizer = lazy(() => import("./pages/TravelOptimizer"));
const OcPlanner = lazy(() => import("./pages/OcPlanner"));
const ChainQueue = lazy(() => import("./pages/ChainQueue"));
const DailyDigest = lazy(() => import("./pages/DailyDigest"));
const ReviveTracker = lazy(() => import("./pages/ReviveTracker"));
const ReviveMarketplace = lazy(() => import("./pages/ReviveMarketplace"));
const SettlementQueue = lazy(() => import("./pages/SettlementQueue"));
const OperatorDashboard = lazy(() => import("./pages/OperatorDashboard"));
const AiSettings = lazy(() => import("./pages/AiSettings"));
const Markets = lazy(() => import("./pages/Markets"));
const Stocks = lazy(() => import("./pages/Stocks"));
const Company = lazy(() => import("./pages/Company"));
const Properties = lazy(() => import("./pages/Properties"));
const Racing = lazy(() => import("./pages/Racing"));
const Community = lazy(() => import("./pages/Community"));
const LiveFeeds = lazy(() => import("./pages/LiveFeeds"));
const Alliances = lazy(() => import("./pages/Alliances"));
const WatchedFactions = lazy(() => import("./pages/WatchedFactions"));
const Recruitment = lazy(() => import("./pages/Recruitment"));
const Gym = lazy(() => import("./pages/Gym"));
const Activity = lazy(() => import("./pages/Activity"));
const Graffiti = lazy(() => import("./pages/Graffiti"));
const Reports = lazy(() => import("./pages/Reports"));
const ApiUsage = lazy(() => import("./pages/ApiUsage"));
const PublicApi = lazy(() => import("./pages/PublicApi"));
const AdminCostDashboard = lazy(() => import("./pages/AdminCostDashboard"));
const CompetitorMatrix = lazy(() => import("./pages/CompetitorMatrix"));
const Halloween = lazy(() => import("./pages/Halloween"));
const FactionOps = lazy(() => import("./pages/FactionOps"));
const FactionFinance = lazy(() => import("./pages/FactionFinance"));
const FactionUpgrades = lazy(() => import("./pages/FactionUpgrades"));
const AllianceSharing = lazy(() => import("./pages/AllianceSharing"));
const RetentionTrends = lazy(() => import("./pages/RetentionTrends"));
const ArmoryHistory = lazy(() => import("./pages/ArmoryHistory"));
const LoanReminders = lazy(() => import("./pages/LoanReminders"));
const Settings = lazy(() => import("./pages/Settings"));
const PlayerIntel = lazy(() => import("./pages/PlayerIntel"));
import { canAccessPage } from "./lib/access";
import { supabase } from "./lib/supabase";

const SharedReport = lazy(() => import("./pages/SharedReport"));
import { useQueryClient } from "@tanstack/react-query";
export default function App() {
  const queryClient = useQueryClient();
  const identityRef = useRef<string | null>(null);
  const [sharedToken, setSharedToken] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [role, setRole] = useState("user");
  useEffect(() => {
    let disposed = false;
    let refreshVersion = 0;
    async function refresh() {
      if (disposed) return;
      const version = ++refreshVersion;
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (disposed || version !== refreshVersion) return;
        const nextIdentity = session?.user.id ?? null;
        if (identityRef.current !== nextIdentity) {
          queryClient.clear();
          setRole("user");
          identityRef.current = nextIdentity;
        }
        setAccountId(nextIdentity);
        setSignedIn(!!session);
        if (session) {
          const { data } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();
          if (
            !disposed &&
            version === refreshVersion &&
            identityRef.current === nextIdentity
          )
            setRole(data?.role ?? "user");
        } else setRole("user");
        setAuthError("");
      } catch {
        if (!disposed && version === refreshVersion)
          setAuthError("Unable to check your session. Reload to try again.");
      } finally {
        if (!disposed && version === refreshVersion) setAuthReady(true);
      }
    }
    void refresh();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (identityRef.current !== (session?.user.id ?? null)) {
        setAuthReady(false);
        setSignedIn(false);
        setRole("user");
        queryClient.clear();
      }
      setTimeout(() => void refresh(), 0);
    });
    return () => {
      disposed = true;
      refreshVersion++;
      subscription.unsubscribe();
    };
  }, []);
  const [page, setPage] = useState<Page>("Overview");
  useEffect(() => {
    const route = () => {
      try {
        const hash = location.hash.replace(/^#\/?/, "");
        setSharedToken(
          /^report\/[a-f0-9]{32}$/.test(hash) ? hash.split("/")[1] : "",
        );
        const name = decodeURIComponent(
          location.hash.replace(/^#\/?/, "").split("?")[0],
        );
        if (NAV.includes(name as Page)) setPage(name as Page);
      } catch {}
    };
    route();
    window.addEventListener("hashchange", route);
    return () => window.removeEventListener("hashchange", route);
  }, []);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return (
    <SpatialShell
      page={page}
      signedIn={signedIn}
      role={role}
      shared={!!sharedToken}
      onNavigate={(next) => {
        setSharedToken("");
        setPage(next);
        location.hash = encodeURIComponent(next);
      }}
    >
      <Suspense fallback={<p role="status">Loading workspace…</p>}>
        {sharedToken ? (
          <SharedReport token={sharedToken} />
        ) : !authReady ? (
          <p role="status">Checking session…</p>
        ) : authError ? (
          <p role="alert">{authError}</p>
        ) : !signedIn ? (
          <Settings />
        ) : !canAccessPage(page, signedIn, role) ? (
          <p role="alert">Your account does not have access to this page.</p>
        ) : (
          <div key={accountId ?? "signed-out"}>
            <TornDataShortcut page={page} />
            {page === "Overview" && <Overview />}
            {page === "Settings" && <Settings />}
            {page === "Player Intel" && <PlayerIntel />}
            {page === "Planner" && <Planner />}
            {page === "Targets" && <Targets />}
            {page === "Compare Players" && <ComparePlayers />}
            {page === "Leaderboards" && <Leaderboards />}
            {page === "ROI Calculator" && <RoiCalculator />}
            {page === "PI Mortgages" && <PiMortgages />}
            {page === "Bounties" && <Bounties />}
            {page === "Stats Catalog" && <StatsCatalog />}
            {page === "Custom Stats" && <CustomStats />}
            {page === "Stat Intelligence" && <StatIntelligence />}
            {page === "Stat Growth" && <StatGrowth />}
            {page === "Spy Reports" && <SpyReports />}
            {page === "War Hits" && <WarHits />}
            {page === "Crime Tracker" && <CrimeTracker />}
            {page === "Flight Tracker" && <FlightTracker />}
            {page === "Dibs" && <Dibs />}
            {page === "Target Pools" && <TargetPools />}
            {page === "Tornipedia" && <Glossary />}
            {page === "Assistant" && <Assistant />}
            {page === "Discord" && <Discord />}
            {page === "Notification Prefs" && <NotificationPrefs />}
            {page === "Alerts" && <Alerts />}
            {page === "Notifications" && <Notifications />}
            {page === "War Room" && <WarRoom />}
            {page === "War Analyzer" && <WarAnalyzer />}
            {page === "AI War Analyzer" && <AiWarAnalyzer />}
            {page === "Payouts" && <PayoutCalculator />}
            {page === "Losses" && <LossMarketplace />}
            {page === "TornStats" && <TornStats />}
            {page === "Travel" && <Travel />}
            {page === "Travel Optimizer" && <TravelOptimizer />}
            {page === "OC Planner" && <OcPlanner />}
            {page === "Chain Queue" && <ChainQueue />}
            {page === "Daily Digest" && <DailyDigest />}
            {page === "Revive Tracker" && <ReviveTracker />}
            {page === "Revive Marketplace" && <ReviveMarketplace />}
            {page === "Settlement Queue" && <SettlementQueue />}
            {page === "Operator Dashboard" && <OperatorDashboard />}
            {page === "AI Settings" && <AiSettings />}
            {page === "Markets" && <Markets />}
            {page === "Stocks" && <Stocks />}
            {page === "Company" && <Company />}
            {page === "Properties" && <Properties />}
            {page === "Racing" && <Racing />}
            {page === "Community" && <Community />}
            {page === "Live Feeds" && <LiveFeeds />}
            {page === "Alliances" && <Alliances />}
            {page === "Watched Factions" && <WatchedFactions />}
            {page === "Recruitment" && <Recruitment />}
            {page === "Gym" && <Gym />}
            {page === "Activity" && <Activity />}
            {page === "Graffiti" && <Graffiti />}
            {page === "Reports" && <Reports />}
            {page === "API Usage" && <ApiUsage />}
            {page === "Public API" && <PublicApi />}
            {page === "Admin Cost Dashboard" && <AdminCostDashboard />}
            {page === "Competitor Matrix" && <CompetitorMatrix />}
            {page === "Halloween" && <Halloween />}
            {page === "Faction" && <FactionOps />}
            {page === "Faction Finance" && <FactionFinance />}
            {page === "Faction Upgrades" && <FactionUpgrades />}
            {page === "Alliance Sharing" && <AllianceSharing />}
            {page === "Retention Trends" && <RetentionTrends />}
            {page === "Armory History" && <ArmoryHistory />}
            {page === "Loan Reminders" && <LoanReminders />}
          </div>
        )}
      </Suspense>
    </SpatialShell>
  );
}
