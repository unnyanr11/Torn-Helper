export interface CompetitorRow {
  feature: string;
  tcc: string;
  tornTools: string;
  yata: string;
  tornStats: string;
}

export const COMPETITORS: CompetitorRow[] = [
  { feature: 'Target intel & spy logs', tcc: 'Yes (spy reports, stat intelligence)', tornTools: 'Partial', yata: 'Partial', tornStats: 'Yes' },
  { feature: 'War room & chain tracking', tcc: 'Yes', tornTools: 'Yes', yata: 'Yes', tornStats: 'Partial' },
  { feature: 'Hospital-timer dibs', tcc: 'Yes', tornTools: 'No', yata: 'No', tornStats: 'No' },
  { feature: 'Target pools', tcc: 'Yes', tornTools: 'Partial', yata: 'No', tornStats: 'No' },
  { feature: 'Flight tracker', tcc: 'Yes', tornTools: 'Yes', yata: 'Yes', tornStats: 'No' },
  { feature: 'ROI / PI mortgage calculators', tcc: 'Yes', tornTools: 'Partial', yata: 'No', tornStats: 'No' },
  { feature: 'Graffiti wall with images', tcc: 'Yes', tornTools: 'No', yata: 'No', tornStats: 'No' },
  { feature: 'Discord webhook integration', tcc: 'Yes', tornTools: 'Yes', yata: 'Partial', tornStats: 'No' },
  { feature: 'Built-in assistant', tcc: 'Yes', tornTools: 'No', yata: 'No', tornStats: 'No' },
  { feature: 'Companion userscript', tcc: 'Yes', tornTools: 'Yes', yata: 'No', tornStats: 'No' },
  { feature: 'PWA / installable', tcc: 'Yes', tornTools: 'No', yata: 'Yes', tornStats: 'No' },
  { feature: 'Public API', tcc: 'Yes', tornTools: 'No', yata: 'Yes', tornStats: 'Yes' },
  { feature: 'Free / no paywall', tcc: 'Yes', tornTools: 'Partial', yata: 'Partial', tornStats: 'Partial' },
];
