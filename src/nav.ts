export const NAV = [
  'Overview', 'Planner', 'Targets', 'Player Intel', 'War Room', 'Faction',
  'Alliances', 'Watched Factions', 'Recruitment', 'Payouts', 'Losses', 'Bounties', 'Travel', 'Markets', 'Company',
  'Properties', 'Racing', 'Community', 'Live Feeds', 'Estimates', 'Alerts', 'Notifications', 'API Usage', 'Settings',
] as const;

export type Page = (typeof NAV)[number];

export const BUILT: Page[] = ['Overview', 'Planner', 'Targets', 'Alerts', 'Notifications', 'War Room', 'Payouts', 'Losses', 'Travel', 'Markets', 'Stocks', 'Company', 'Properties', 'Racing', 'Community', 'Live Feeds', 'Estimates', 'Alliances', 'Watched Factions', 'Recruitment', 'API Usage'];
