export type Source = 'official API' | 'derived calculation' | 'manual input' | 'future work';

export interface Widget {
  title: string;
  value: string;
  note: string;
  source: Source;
  updated: string;
  permission: string;
  stale: boolean;
}

// All values are seeded DEMO examples, not live Torn data.
export const DEMO_WIDGETS: Widget[] = [
  { title: 'Energy', value: '120 / 150', note: 'Avoid hitting a full bar', source: 'official API', updated: 'demo', permission: 'Minimal access', stale: false },
  { title: 'Nerve', value: '38 / 55', note: 'Regenerating', source: 'official API', updated: 'demo', permission: 'Minimal access', stale: false },
  { title: 'Cooldowns', value: 'Drug 02:14:00', note: 'Medical and booster not active', source: 'official API', updated: 'demo', permission: 'Minimal access', stale: true },
  { title: 'Goal: 5M cash', value: '62%', note: 'Computed from your manual target', source: 'derived calculation', updated: 'demo', permission: 'None', stale: false },
];

export const DEMO_NEXT = [
  { text: 'Spend energy before it fills', why: 'Energy is at 80% of max (demo input).' },
  { text: 'Review levelling targets', why: 'Goal "levelling" is enabled.' },
];
