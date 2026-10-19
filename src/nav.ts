export const NAV = [
  'Overview', 'Planner', 'Targets', 'Player Intel', 'War Room', 'Faction',
  'Payouts', 'Losses', 'Bounties', 'Travel', 'Markets', 'Company',
  'Properties', 'Racing', 'Community', 'Alerts', 'API Usage', 'Settings',
] as const;

export type Page = (typeof NAV)[number];

// Phase 1 pages that are implemented; others show an honest "not built yet" state.
export const BUILT: Page[] = ['Overview'];
