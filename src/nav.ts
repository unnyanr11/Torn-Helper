export const NAV = [
  'Overview', 'Planner', 'Targets', 'Compare Players', 'Leaderboards', 'ROI Calculator', 'PI Mortgages', 'Bounties', 'Stats Catalog', 'Custom Stats', 'Stat Intelligence', 'Stat Growth', 'Spy Reports', 'War Hits', 'Crime Tracker', 'Flight Tracker', 'Dibs', 'Target Pools', 'Tornipedia', 'Assistant', 'Discord', 'Notification Prefs', 'TornStats', 'Player Intel', 'War Room', 'War Analyzer', 'Faction',
  'Alliances', 'Watched Factions', 'Recruitment', 'Gym', 'Activity', 'Graffiti', 'Payouts', 'Losses', 'Travel', 'Markets', 'Company',
  'Properties', 'Racing', 'Community', 'Live Feeds', 'Alerts', 'Notifications', 'Reports', 'API Usage', 'Public API', 'Admin Cost Dashboard', 'Competitor Matrix', 'Halloween', 'Settings',
] as const;

export type Page = (typeof NAV)[number];

export const BUILT: Page[] = ['Overview', 'Planner', 'Targets', 'Compare Players', 'Leaderboards', 'ROI Calculator', 'PI Mortgages', 'Bounties', 'Stats Catalog', 'Custom Stats', 'Stat Intelligence', 'Stat Growth', 'Spy Reports', 'War Hits', 'Crime Tracker', 'Flight Tracker', 'Dibs', 'Target Pools', 'Tornipedia', 'Assistant', 'Discord', 'Notification Prefs', 'TornStats', 'Alerts', 'Notifications', 'War Room', 'War Analyzer', 'Payouts', 'Losses', 'Travel', 'Markets', 'Stocks', 'Company', 'Properties', 'Racing', 'Community', 'Live Feeds', 'Alliances', 'Watched Factions', 'Recruitment', 'Gym', 'Activity', 'Graffiti', 'Reports', 'API Usage', 'Public API', 'Admin Cost Dashboard', 'Competitor Matrix', 'Halloween', 'Faction'];
