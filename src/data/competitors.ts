// Torn Command Center - competitor coverage matrix (spec section 7C #16)
// Each row: feature, competitor, source URL, date checked, freemium status, acceptance test, blocker visibility

export interface MatrixRow {
  feature: string;
  competitor: string;
  sourceUrl: string;
  dateChecked: string;
  freemium: 'free' | 'freemium' | 'paid' | 'unknown';
  acceptanceTest: string;
  blockerVisibility: 'public' | 'internal' | 'none';
}

export const COMPETITOR_MATRIX: MatrixRow[] = [
  { feature: 'Spy reports / stat intelligence', competitor: 'TornStats', sourceUrl: 'https://tornstats.com', dateChecked: '2026-10-19', freemium: 'freemium', acceptanceTest: 'User can view a target\'s battle stats from a spy report', blockerVisibility: 'public' },
  { feature: 'Target finder / chaining', competitor: 'TornTools', sourceUrl: 'https://torn.tools', dateChecked: '2026-10-19', freemium: 'freemium', acceptanceTest: 'User can filter targets by level/country/status and chain them', blockerVisibility: 'public' },
  { feature: 'Travel / flying profit', competitor: 'YATA', sourceUrl: 'https://yata.yt', dateChecked: '2026-10-19', freemium: 'free', acceptanceTest: 'User sees live travel item prices and profit per country', blockerVisibility: 'public' },
  { feature: 'Stock market / portfolio', competitor: 'TornWise', sourceUrl: 'https://tornwise.com', dateChecked: '2026-10-19', freemium: 'freemium', acceptanceTest: 'User can view stock prices and portfolio value', blockerVisibility: 'public' },
  { feature: 'Bazaar / item market', competitor: 'TornTools', sourceUrl: 'https://torn.tools/bazaar', dateChecked: '2026-10-19', freemium: 'freemium', acceptanceTest: 'User can search an item and see lowest bazaar prices', blockerVisibility: 'public' },
  { feature: 'Faction war tracking', competitor: 'TornStats', sourceUrl: 'https://tornstats.com/faction', dateChecked: '2026-10-19', freemium: 'freemium', acceptanceTest: 'Faction leader can view member war hits and chain contributions', blockerVisibility: 'public' },
  { feature: 'Payout calculator', competitor: 'None (niche)', sourceUrl: '', dateChecked: '2026-10-19', freemium: 'unknown', acceptanceTest: 'Leader can run equal/proportional/weighted/hybrid payout with caps and floors', blockerVisibility: 'none' },
  { feature: 'Loss marketplace', competitor: 'None (niche)', sourceUrl: '', dateChecked: '2026-10-19', freemium: 'unknown', acceptanceTest: 'Seller lists a verified loss, buyer claims, earnings reconcile', blockerVisibility: 'none' },
  { feature: 'Property ROI / mortgages', competitor: 'TornWise', sourceUrl: 'https://tornwise.com/property', dateChecked: '2026-10-19', freemium: 'freemium', acceptanceTest: 'User can compare property ROI including mortgage interest', blockerVisibility: 'public' },
  { feature: 'Racing stats', competitor: 'TornStats', sourceUrl: 'https://tornstats.com/racing', dateChecked: '2026-10-19', freemium: 'freemium', acceptanceTest: 'User can view car stats and racing history', blockerVisibility: 'public' },
  { feature: 'Education / course planner', competitor: 'TornTools', sourceUrl: 'https://torn.tools/education', dateChecked: '2026-10-19', freemium: 'freemium', acceptanceTest: 'User can plan education courses toward a goal', blockerVisibility: 'public' },
  { feature: 'Company / job tracking', competitor: 'YATA', sourceUrl: 'https://yata.yt/company', dateChecked: '2026-10-19', freemium: 'free', acceptanceTest: 'Employee can view company stats and their own effectiveness', blockerVisibility: 'public' },
  { feature: 'Gym / stat gain calculator', competitor: 'TornStats', sourceUrl: 'https://tornstats.com/gym', dateChecked: '2026-10-19', freemium: 'freemium', acceptanceTest: 'User sees projected gains per gym at current stats', blockerVisibility: 'public' },
  { feature: 'Crime / OC tracking', competitor: 'TornStats', sourceUrl: 'https://tornstats.com/crime', dateChecked: '2026-10-19', freemium: 'freemium', acceptanceTest: 'User can view crime success rates and OC readiness', blockerVisibility: 'public' },
  { feature: 'Bounty board', competitor: 'TornTools', sourceUrl: 'https://torn.tools/bounties', dateChecked: '2026-10-19', freemium: 'freemium', acceptanceTest: 'User can view active bounties sorted by value', blockerVisibility: 'public' },
  { feature: 'Discord integration', competitor: 'TornStats', sourceUrl: 'https://tornstats.com/discord', dateChecked: '2026-10-19', freemium: 'freemium', acceptanceTest: 'Faction can receive chain/war alerts in Discord', blockerVisibility: 'public' },
];
