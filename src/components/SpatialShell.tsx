import { useEffect, useRef, useState, type ReactNode } from "react";
import { NAV, type Page } from "../nav";
import { canAccessPage } from "../lib/access";
import { useSpatialMotion } from "../hooks/useSpatialMotion";
const categories: Record<string, string[]> = {
  Workspace: [
    "Overview",
    "Planner",
    "Live Feeds",
    "Compare Players",
    "Leaderboards",
    "Daily Digest",
  ],
  Intelligence: [
    "Targets",
    "Player Intel",
    "Stats Catalog",
    "Custom Stats",
    "Stat Intelligence",
    "Stat Growth",
    "Spy Reports",
    "TornStats",
    "Activity",
    "Reports",
  ],
  Operations: [
    "War Room",
    "War Hits",
    "War Analyzer",
    "AI War Analyzer",
    "Dibs",
    "Target Pools",
    "OC Planner",
    "Chain Queue",
    "Revive Tracker",
    "Revive Marketplace",
    "Bounties",
    "Losses",
    "Settlement Queue",
    "Operator Dashboard",
  ],
  Faction: [
    "Faction",
    "Faction Finance",
    "Faction Upgrades",
    "Alliance Sharing",
    "Retention Trends",
    "Armory History",
    "Loan Reminders",
    "Alliances",
    "Watched Factions",
    "Recruitment",
    "Payouts",
  ],
  Economy: [
    "ROI Calculator",
    "PI Mortgages",
    "Markets",
    "Stocks",
    "Company",
    "Properties",
    "Travel",
    "Travel Optimizer",
    "Flight Tracker",
  ],
  Explore: [
    "Crime Tracker",
    "Gym",
    "Racing",
    "Community",
    "Graffiti",
    "Halloween",
    "Tornipedia",
    "Assistant",
    "Discord",
  ],
  Account: [
    "Alerts",
    "Notifications",
    "Notification Prefs",
    "AI Settings",
    "API Usage",
    "Public API",
    "Admin Cost Dashboard",
    "Competitor Matrix",
    "Settings",
  ],
};
const navLabel = (page: Page) =>
  page === "Live Feeds" ? "Torn Data Browser" : page;
function Glyph({ name, className = "" }: { name: string; className?: string }) {
  const paths: Record<string, ReactNode> = {
    Workspace: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    Intelligence: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5M7 11l2 2 4-4" />
      </>
    ),
    Operations: (
      <>
        <path d="m12 3 8 4v5c0 4-4 7-8 9-4-2-8-5-8-9V7l8-4Z" />
        <path d="m9 12 2 2 4-5" />
      </>
    ),
    Faction: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5" />
      </>
    ),
    Economy: (
      <>
        <path d="M3 20h18M5 16V9m7 7V4m7 12v-5M3 6l5-3" />
      </>
    ),
    Explore: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
      </>
    ),
    Account: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ),
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 5 5" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </>
    ),
    moon: <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z" />,
    motion: (
      <>
        <path d="m4 17 5-5-5-5m8 10 5-5-5-5M21 5v14" />
      </>
    ),
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
  };
  return (
    <svg
      className={`glyph ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.Explore}
    </svg>
  );
}
export default function SpatialShell({
  page,
  signedIn,
  role,
  shared,
  onNavigate,
  children,
}: {
  page: Page;
  signedIn: boolean;
  role: string;
  shared: boolean;
  onNavigate: (page: Page) => void;
  children: ReactNode;
}) {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      return localStorage.getItem("tcc-theme") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  const [reduced, setReduced] = useState(() => {
    try {
      return localStorage.getItem("tcc-motion") === "reduced";
    } catch {
      return false;
    }
  });
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState("");
  const input = useRef<HTMLInputElement>(null),
    menu = useRef<HTMLButtonElement>(null);
  useSpatialMotion(reduced);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#080d19" : "#eaf0f8");
    try {
      localStorage.setItem("tcc-theme", theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? "reduced" : "full";
    try {
      localStorage.setItem("tcc-motion", reduced ? "reduced" : "full");
    } catch {}
  }, [reduced]);
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => input.current?.focus());
      }
      if (event.key === "Escape") {
        setOpen(false);
        menu.current?.focus();
      }
    };
    document.addEventListener("keydown", keys);
    return () => document.removeEventListener("keydown", keys);
  }, []);
  useEffect(() => {
    setOpen(false);
  }, [page]);
  useEffect(() => {
    if (!open || !matchMedia("(max-width: 800px)").matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  const navigate = (next: Page) => {
    onNavigate(next);
    setOpen(false);
    setSearch("");
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const allowed = NAV.filter((name) => canAccessPage(name, signedIn, role));
  const filtered = allowed.filter((name) =>
    navLabel(name).toLowerCase().includes(search.toLowerCase()),
  );
  const title = shared
    ? "Shared snapshot"
    : signedIn
      ? navLabel(page)
      : "Welcome to your workspace";
  const dock: Page[] = [
    "Overview",
    "Compare Players",
    "Live Feeds",
    "Settings",
  ];
  return (
    <div className={`layout spatial-layout ${open ? "navigation-open" : ""}`}>
      <div className="spatial-scene" aria-hidden="true">
        <div className="scene-orb orb-one" />
        <div className="scene-orb orb-two" />
        <div className="scene-orb orb-three" />
        <div className="scene-grid" />
      </div>
      <a
        href="#workspace-content"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("workspace-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <button
        ref={menu}
        className="nu-btn menu-btn icon-button"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls="spatial-navigation"
        onClick={() => setOpen((value) => !value)}
      >
        <Glyph name={open ? "close" : "menu"} />
      </button>
      {open && (
        <button
          className="navigation-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <nav
        id="spatial-navigation"
        className={`sidebar ${open ? "open" : ""}`}
        aria-label="Main"
      >
        <button
          className="brand"
          onClick={() => navigate(signedIn ? "Overview" : "Settings")}
          aria-label="Torn Command Center home"
        >
          <span className="brand-emblem" aria-hidden="true">
            T<span />
          </span>
          <span>
            Torn<span className="brand-secondary">COMMAND CENTER</span>
          </span>
          <span className="brand-orbit" aria-hidden="true" />
        </button>
        <div className="nav-search">
          <Glyph name="search" />
          <input
            ref={input}
            aria-label="Find a workspace"
            placeholder="Find a workspace…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <kbd>⌘ K</kbd>
        </div>
        <div className="nav-scroll">
          {Object.entries(categories).map(([category, names]) => {
            const pages = filtered.filter((name) => names.includes(name));
            return (
              !!pages.length && (
                <div className="nav-group" key={category}>
                  <p className="nav-group-label">{category}</p>
                  {pages.map((name) => (
                    <button
                      key={name}
                      className={`nav-item ${name === page && !shared ? "active" : ""}`}
                      aria-current={
                        name === page && !shared ? "page" : undefined
                      }
                      onClick={() => navigate(name)}
                    >
                      <span className="nav-icon">
                        <Glyph name={category} />
                      </span>
                      <span>{navLabel(name)}</span>
                      <span className="nav-chevron" aria-hidden="true">
                        ↗
                      </span>
                    </button>
                  ))}
                </div>
              )
            );
          })}
          {!filtered.length && (
            <p className="nav-empty">No workspaces match “{search}”.</p>
          )}
        </div>
        <button className="account-tile" onClick={() => navigate("Settings")}>
          <span className="account-avatar">
            <Glyph name="Account" />
          </span>
          <span>
            {signedIn ? "Your workspace" : "Continue with Torn"}
            <small>
              <span className={`status-dot ${signedIn ? "connected" : ""}`} />
              {signedIn ? "Account connected" : "Sign in to connect"}
            </small>
          </span>
          <span aria-hidden="true">↗</span>
        </button>
      </nav>
      <main id="workspace-content" className="content" tabIndex={-1}>
        <header className="topbar">
          <div className="workspace-heading">
            <span className="eyebrow">
              TORN / {shared ? "REPORT" : "WORKSPACE"}
            </span>
            <h1>{title}</h1>
          </div>
          <div className="topbar-actions">
            <span className="session-label">
              <span className={`status-dot ${signedIn ? "connected" : ""}`} />
              {shared
                ? "Published snapshot"
                : signedIn
                  ? "Private workspace"
                  : "Your city, in perspective"}
            </span>
            <button
              className="nu-btn icon-button"
              title={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              aria-label={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Glyph name={theme === "dark" ? "sun" : "moon"} />
            </button>
            <button
              className="nu-btn icon-button motion-toggle"
              aria-label="Reduce animations"
              aria-pressed={reduced}
              title={reduced ? "Full animations" : "Reduce animations"}
              onClick={() => setReduced((value) => !value)}
            >
              <Glyph name="motion" />
            </button>
          </div>
        </header>
        <div
          className="workspace-stage"
          key={shared ? "shared" : signedIn ? page : "sign-in"}
        >
          {children}
        </div>
        <footer className="workspace-footer">
          <span className="footer-mark" aria-hidden="true">
            ◈
          </span>{" "}
          Torn Command Center <span>Independent tools. Your perspective.</span>
        </footer>
      </main>
      {signedIn && (
        <div className="spatial-dock" aria-label="Quick navigation">
          {dock
            .filter((name) => allowed.includes(name))
            .map((name) => (
              <button
                className={`dock-item ${name === page ? "active" : ""}`}
                aria-current={name === page && !shared ? "page" : undefined}
                key={name}
                onClick={() => navigate(name)}
                title={navLabel(name)}
              >
                <Glyph
                  name={
                    name === "Overview"
                      ? "Workspace"
                      : name === "Settings"
                        ? "Account"
                        : name === "Compare Players"
                          ? "Intelligence"
                          : "Explore"
                  }
                />
                <span>
                  {name === "Live Feeds"
                    ? "Data"
                    : name === "Compare Players"
                      ? "Compare"
                      : name}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
