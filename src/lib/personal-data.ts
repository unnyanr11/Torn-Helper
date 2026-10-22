import { CAPABILITIES } from '../api/capabilities';
import type { Capability } from '../api/types';
export type TornObservation = { endpoint_id: string; payload: unknown; fetched_at: string; cached?: boolean; parameters: Record<string, string>; next_parameters: Record<string, string> | null };
export function dataLabel(value: string): string {
  const words: Record<string, string> = { battlestats: 'Battle stats', personalstats: 'Personal statistics', workstats: 'Working stats', networth: 'Net worth', jobpoints: 'Job points', weaponexp: 'Weapon experience' };
  return words[value] ?? value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^./, c => c.toUpperCase());
}
export function dataCategory(path: string): string {
  const name = path.split('/')[2] ?? '';
  if (/attack|battlestats|revive|weapon|equipment|ammo|bount/.test(name)) return 'Combat';
  if (/money|networth|stocks|inventory|item|trade|propert/.test(name)) return 'Wealth & items';
  if (/job|work|education|gym|skill|merit|perk|honor|medal|personalstats/.test(name)) return 'Progress & stats';
  if (/forum|message|event|notification|discord|list/.test(name)) return 'Social & activity';
  if (/race|racing|enlisted/.test(name)) return 'Racing';
  return 'Life in Torn';
}
// Only owner endpoints with fully specified parameters belong in a bulk personal sync.
// Lookup/search/meta and generic multi-selection routes are tools, not personal datasets.
export const PERSONAL_SECTIONS = CAPABILITIES.filter(c => c.group === 'user' && !c.path.includes('{') && !['/user', '/user/search', '/user/lookup', '/user/timestamp'].includes(c.path));
export type PersonalRequest = { capability: Capability; parameters: Record<string, string>; label: string };
export const PERSONAL_REQUESTS: PersonalRequest[] = PERSONAL_SECTIONS.flatMap<PersonalRequest>(capability => {
  if (capability.path === '/user/list') return ['Friends', 'Enemies', 'Targets'].map(cat => ({ capability, parameters: { cat }, label: cat }));
  if (capability.parameters.some(p => p.required && ['path', 'query'].includes(p.location))) return [];
  const parameters: Record<string, string> = capability.path === '/user/personalstats' ? { cat: 'all' } : {};
  return [{ capability, parameters, label: dataLabel(capability.path.split('/')[2]) }];
});
export function observationKey(endpoint: string, parameters: Record<string, string>) {
  return `${endpoint}:${JSON.stringify(Object.entries(parameters).sort(([a], [b]) => a.localeCompare(b)))}`;
}
export function numericChange(value: unknown, previous: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && typeof previous === 'number' && Number.isFinite(previous) ? value - previous : null;
}
