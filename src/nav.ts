export const NAV = [
  'Overview', 'Planner', 'Targets', 'Compare Players', 'Leaderboards', 'ROI Calculator', 'Player Intel', 'War Room', 'War Analyzer', 'Faction',
  'Alliances', 'Watched Factions', 'Recruitment', 'Gym', 'Activity', 'Graffiti', 'Payouts', 'Losses', 'Bounties', 'Travel', 'Markets', 'Company',
  'Properties', 'Racing', 'Community', 'Live Feeds', 'Estimates', 'Alerts', 'Notifications', 'Reports', 'API Usage', 'Settings',
] as const;

export type Page = (typeof NAV)[number];

export const BUILT: Page[] = ['Overview', 'Planner', 'Targets', 'Compare Players', 'Leaderboards', 'ROI Calculator', 'Alerts', 'Notifications', 'War Room', 'War Analyzer', 'Payouts', 'Losses', 'Travel', 'Markets', 'Stocks', 'Company', 'Properties', 'Racing', 'Community', 'Live Feeds', 'Estimates', 'Alliances', 'Watched Factions', 'Recruitment', 'Gym', 'Activity', 'Graffiti', 'Reports', 'API Usage'];
