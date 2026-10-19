export interface GlossaryEntry {
  term: string;
  category: string;
  definition: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  { term: 'Chain', category: 'Faction', definition: 'A faction-wide sequence of hits; each member hit extends the chain within a time window.' },
  { term: 'Dibs', category: 'War', definition: 'A claim on a target before they leave the hospital, reserving the hit for a set window.' },
  { term: 'Fair Fight', category: 'Combat', definition: 'A formula that scales respect based on the stat difference between attacker and target.' },
  { term: 'FF', category: 'Combat', definition: 'Shorthand for Fair Fight multiplier.' },
  { term: 'Glass Cannon', category: 'Builds', definition: 'A build with very high dexterity/speed but low defense; hits hard but takes damage easily.' },
  { term: 'Tank', category: 'Builds', definition: 'A build with high defense and strength; absorbs damage but moves slower.' },
  { term: 'Dex-Heavy', category: 'Builds', definition: 'A build emphasizing dexterity for accuracy and critical hits.' },
  { term: 'Spy', category: 'Intel', definition: 'A report revealing another player\'s battle stats, usually from a faction spy or third-party tool.' },
  { term: 'Chain Hit', category: 'Faction', definition: 'A single hit contributing to the faction chain.' },
  { term: 'Respect', category: 'Faction', definition: 'Currency earned from faction activities; spendable on faction upgrades.' },
  { term: 'Ranked War', category: 'War', definition: 'A formal war between factions with ranked scoring and rewards.' },
  { term: 'Territory War', category: 'War', definition: 'A war over control of map territories.' },
  { term: 'Raid', category: 'War', definition: 'A faction-versus-faction assault on a specific objective.' },
  { term: 'Bazaar', category: 'Economy', definition: 'A player-run shop listing items for sale.' },
  { term: 'Item Market', category: 'Economy', definition: 'The central marketplace for buying and selling items.' },
  { term: 'Points Market', category: 'Economy', definition: 'Market for trading Torn points.' },
  { term: 'Refill', category: 'Mechanics', definition: 'A daily reset of energy/nerve to full, purchasable with points.' },
  { term: 'Hospital', category: 'Mechanics', definition: 'Where players recover after being defeated; exit time is strategically important.' },
  { term: 'Jail', category: 'Mechanics', definition: 'Where players are held after failed crimes or being busted; bail or bust mechanics apply.' },
  { term: 'Travel', category: 'Mechanics', definition: 'Moving between Torn and foreign countries; takes real time and enables foreign item access.' },
  { term: 'Company', category: 'Economy', definition: 'A player-run business employing members; provides job points and perks.' },
  { term: 'Education', category: 'Progression', definition: 'Courses that grant permanent perks and stat boosts.' },
  { term: 'Gym', category: 'Progression', definition: 'Where players train battle stats using energy.' },
  { term: 'Crime', category: 'Progression', definition: 'Skill-based activities with success/failure outcomes and rewards.' },
  { term: 'Racing', category: 'Progression', definition: 'Car races earning points spendable on car upgrades.' },
  { term: 'Museum', category: 'Collections', definition: 'Where players donate item sets for permanent bonuses.' },
  { term: 'Awards', category: 'Collections', definition: 'Achievements earned through gameplay milestones.' },
  { term: 'Merits', category: 'Progression', definition: 'Spendable points earned from leveling, used for permanent stat/perk boosts.' },
  { term: 'Donator', category: 'Account', definition: 'A player who has purchased donator status, unlocking extra features.' },
  { term: 'Faction', category: 'Faction', definition: 'A player-run group with shared chat, chain, and war capabilities.' },
];
