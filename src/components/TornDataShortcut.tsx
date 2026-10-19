const sections: Record<string, string> = {
  Stocks: "v2-user-stocks",
  Company: "v2-company",
  Properties: "v2-user-properties",
  Markets: "v2-market",
  Travel: "v2-user-travel",
  "Flight Tracker": "v2-user-travel",
  Gym: "v2-user-gym",
  "Crime Tracker": "v2-user-{crimeId}-crimes",
  "OC Planner": "v2-user-organizedcrime",
  "War Hits": "v2-user-attacks",
  Bounties: "v2-user-bounties",
  Racing: "v2-user-races",
  "Stat Intelligence": "v2-user-personalstats",
  "Stat Growth": "v2-user-personalstats",
  Faction: "v2-faction",
  "Faction Finance": "v2-faction-balance",
  "Faction Upgrades": "v2-faction-upgrades",
  "Armory History": "v2-faction-news",
  Community: "v2-forum",
  Notifications: "v2-user-notifications",
};
export default function TornDataShortcut({ page }: { page: string }) {
  const section = sections[page];
  return section ? (
    <p>
      <a
        className="nu-btn"
        href={`#Live%20Feeds?section=${encodeURIComponent(section)}`}
      >
        Load official Torn data for {page}
      </a>
    </p>
  ) : null;
}
