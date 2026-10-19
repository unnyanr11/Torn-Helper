export const NAV = [
  'Overview', 'Planner', 'Targets', 'Compare Players', 'Leaderboards', 'ROI Calculator', 'PI Mortgages', 'Bounties', 'Stats Catalog', 'Custom Stats', 'Stat Intelligence', 'Player Intel', 'War Room', 'War Analyzer', 'Faction',
  'Alliances', 'Watched Factions', 'Recruitment', 'Gym', 'Activity', 'Graffiti', 'Payouts', 'Losses', 'Travel', 'Markets', 'Company',
  'Properties', 'Racing', 'Community', 'Live Feeds', 'Alerts', 'Notifications', 'Reports', 'API Usage', 'Settings',
] as const;

export type Page = (typeof NAV)[number];

export const BUILT: Page[] = ['Overview', 'Planner', 'Targets', 'Compare Players', 'Leaderboards', 'ROI Calculator', 'PI Mortgages', 'Bounties', 'Stats Catalog', 'Custom Stats', 'Stat Intelligence', 'Alerts', 'Notifications', 'War Room', 'War Analyzer', 'Payouts', 'Losses', 'Travel', 'Markets', 'Stocks', 'Company', 'Properties', 'Racing', 'Community', 'Live Feeds', 'Alliances', 'Watched Factions', 'Recruitment', 'Gym', 'Activity', 'Graffiti', 'Reports', 'API Usage'];
