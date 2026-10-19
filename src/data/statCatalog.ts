export interface StatEntry {
  name: string;
  category: string;
  description: string;
}

export const STAT_CATALOG: StatEntry[] = [
  { name: 'Strength', category: 'Battle', description: 'Melee damage and gym training stat.' },
  { name: 'Defense', category: 'Battle', description: 'Reduces damage taken; gym training stat.' },
  { name: 'Speed', category: 'Battle', description: 'Dodge and initiative; gym training stat.' },
  { name: 'Dexterity', category: 'Battle', description: 'Accuracy and critical hits; gym training stat.' },
  { name: 'Total Battle Stats', category: 'Battle', description: 'Sum of strength, defense, speed, and dexterity.' },
  { name: 'Energy', category: 'Bars', description: 'Used for gym, crimes, and other actions; regenerates over time.' },
  { name: 'Nerve', category: 'Bars', description: 'Used for attacks and some crimes; regenerates over time.' },
  { name: 'Happy', category: 'Bars', description: 'Affects gym gains and some actions; restored via items.' },
  { name: 'Life', category: 'Bars', description: 'Health; reduced by damage, restored over time or via items.' },
  { name: 'Chain', category: 'Bars', description: 'Faction chain bar; builds with member hits.' },
  { name: 'Job Points', category: 'Job', description: 'Earned from company work; spendable on company perks.' },
  { name: 'Company Merit', category: 'Job', description: 'Contribution measure within a company.' },
  { name: 'Education Points', category: 'Education', description: 'Earned by completing courses; unlock perks.' },
  { name: 'Intelligence', category: 'Education', description: 'Boosted by education; affects certain mechanics.' },
  { name: 'Endurance', category: 'Education', description: 'Boosted by education; affects certain mechanics.' },
  { name: 'Crime Skill', category: 'Crimes', description: 'Per-crime skill level affecting success rate.' },
  { name: 'Selling Nerve', category: 'Crimes', description: 'Nerve-based crime mechanic.' },
  { name: 'Burglary Skill', category: 'Crimes', description: 'Burglary-specific crime skill.' },
  { name: 'Racing Skill', category: 'Racing', description: 'Racing proficiency affecting performance.' },
  { name: 'Racing Points', category: 'Racing', description: 'Earned from races; spendable on car upgrades.' },
  { name: 'Faction Respect', category: 'Faction', description: 'Earned from faction activities; spendable on upgrades.' },
  { name: 'Faction Chain Count', category: 'Faction', description: 'Current chain hit count for the faction.' },
  { name: 'Networth', category: 'Misc', description: 'Total value of assets including cash, property, and items.' },
  { name: 'Level', category: 'Misc', description: 'Player level; unlocks features and content.' },
  { name: 'Age', category: 'Misc', description: 'Days since account creation.' },
  { name: 'Logins', category: 'Misc', description: 'Total login count.' },
  { name: 'Awards', category: 'Misc', description: 'Number of awards earned.' },
  { name: 'Friends', category: 'Misc', description: 'Number of friends.' },
  { name: 'Enemies', category: 'Misc', description: 'Number of enemies.' },
  { name: 'Refills', category: 'Misc', description: 'Number of refills used.' },
  { name: 'Donations', category: 'Misc', description: 'Total donation amount.' },
  { name: 'Ranked Warnings', category: 'Misc', description: 'Number of ranked warnings received.' },
  { name: 'Bazaar Value', category: 'Misc', description: 'Total value of bazaar listings.' },
  { name: 'Museum Value', category: 'Misc', description: 'Total value of museum sets.' },
];
