import { CAPABILITIES } from '../api/capabilities';
import { dataLabel, observationKey, PERSONAL_REQUESTS, type PersonalRequest, type TornObservation } from './personal-data';
export type ConnectedRequest = PersonalRequest & { areas: string[] };
export type DataEntry = { observation?: TornObservation; previous?: unknown; error?: string };
export const AREAS = ['Personal', 'Crimes', 'Inventory', 'Investments', 'Faction', 'Company', 'Properties', 'Combat', 'Racing', 'Progress'];
export function request(path: string, area: string, parameters: Record<string, string> = {}, label?: string): ConnectedRequest {
  const capability = CAPABILITIES.find(c => c.path === path);
  if (!capability) throw new Error(`Unsupported Torn section: ${path}`);
  return { capability, parameters, label: label ?? dataLabel(path.split('/').pop()!), areas: [area] };
}
export function mergeRequests(rows: ConnectedRequest[]): ConnectedRequest[] {
  const unique = new Map<string, ConnectedRequest>();
  for (const row of rows) {
    const id = observationKey(row.capability.id, row.parameters), old = unique.get(id);
    unique.set(id, old ? { ...old, areas: [...new Set([...old.areas, ...row.areas])] } : row);
  }
  return [...unique.values()];
}
const seeds = (area: string, paths: string[]) => paths.map(p => request(p, area));
export const CONNECTED_REQUESTS = mergeRequests([
  ...PERSONAL_REQUESTS.map(r => ({ ...r, areas: ['Personal'] })),
  ...seeds('Crimes', ['/torn/crimes', '/user/skills']),
  request('/user/personalstats', 'Crimes', { cat: 'crimes' }),
  ...seeds('Inventory', ['/user/inventory', '/torn/items', '/torn/itemammo', '/torn/itemmods', '/torn/museum']),
  ...seeds('Investments', ['/user/stocks', '/user/money', '/torn/stocks', '/torn/bank', '/market/pointsmarket']),
  ...seeds('Faction', ['/faction/basic', '/faction/members', '/faction/chain', '/faction/chains', '/faction/chainreport', '/faction/rankedwars', '/faction/crimes', '/faction/upgrades', '/faction/balance', '/faction/stats', '/faction/positions', '/faction/wars', '/faction/territory', '/faction/attacks', '/faction/crimeexp']),
  ...['weapons','armor','temporary','medical','consumables','drugs','boosters','utilities','loot'].map(cat => request('/faction/inventory', 'Faction', { cat }, `Armory · ${cat}`)),
  ...['main','attack','armoryDeposit','armoryAction','territoryWar','rankedWar','territoryGain','chain','crime','membership','depositFunds','giveFunds'].map(cat => request('/faction/news', 'Faction', { cat }, `News · ${cat}`)),
  ...['attackswon','revives','gymtrains','organisedcrimerespect','traveltimes'].map(stat => request('/faction/contributors', 'Faction', { stat }, `Contributors · ${stat}`)),
  ...seeds('Company', ['/company/profile', '/company/employees', '/company/stock', '/company/applications']), request('/company/news', 'Company', { cat: 'all' }),
  ...seeds('Properties', ['/user/property', '/user/properties', '/torn/properties']),
  ...seeds('Combat', ['/user/attacks', '/user/weaponexp', '/user/equipment', '/user/battlestats', '/faction/attacks']),
  ...seeds('Racing', ['/user/races', '/user/racingrecords', '/user/enlistedcars', '/racing/tracks', '/racing/cars', '/racing/carupgrades']),
  ...seeds('Progress', ['/user/education', '/user/gym', '/user/merits', '/user/honors', '/user/medals', '/user/perks', '/torn/education', '/torn/gyms', '/torn/merits', '/torn/honors', '/torn/medals', '/torn/factiontree']),
]);
export const object = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {};
export const list = (v: unknown): Record<string, any>[] => Array.isArray(v) ? v.filter(r => r && typeof r === 'object' && !Array.isArray(r)) : [];
const positiveId = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
// Related requests are formed from documented returned IDs, never arbitrary upstream URLs.
// The UI offers all related links; the collector limits automatic expansion separately.
export function relatedRequests(row: ConnectedRequest, payload: unknown): ConnectedRequest[] {
  const p = object(payload), path = row.capability.path, out: ConnectedRequest[] = [];
  const add = (items: unknown, target: string, area: string, param: string, prefix: string) => {
    for (const item of list(items)) if (positiveId(item.id)) out.push(request(target, area, { [param]: String(item.id) }, `${prefix} · ${item.name ?? item.id}`));
  };
  if (path === '/torn/crimes') {
    add(p.crimes, '/user/{crimeId}/crimes', 'Crimes', 'crimeId', 'Crime statistics');
    add(p.crimes, '/torn/{crimeId}/subcrimes', 'Crimes', 'crimeId', 'Crime actions');
  }
  if (path === '/user/inventory') {
    const items = object(p.inventory).items;
    add(items, '/market/{id}/itemmarket', 'Inventory', 'id', 'Item listings');
    for (const item of list(items)) if (positiveId(item.id)) out.push(request('/torn/{ids}/items', 'Inventory', { ids: String(item.id) }, `Item details · ${item.name ?? item.id}`));
  }
  if (path === '/user/stocks') add(p.stocks, '/torn/{stockId}/stocks', 'Investments', 'stockId', 'Stock chart');
  if (path === '/torn/properties') for (const item of list(p.properties)) if (positiveId(item.id)) {
    out.push(request('/market/{propertyTypeId}/properties', 'Properties', { propertyTypeId: String(item.id) }, `For sale · ${item.name ?? item.id}`));
    out.push(request('/market/{propertyTypeId}/rentals', 'Properties', { propertyTypeId: String(item.id) }, `For rent · ${item.name ?? item.id}`));
  }
  if (path === '/user/properties') add(p.properties, '/property/{id}/property', 'Properties', 'id', 'Property details');
  if (path === '/user/races') add(p.races, '/racing/{raceId}/race', 'Racing', 'raceId', 'Race details');
  if (path === '/racing/tracks') for (const item of list(p.tracks)) if (positiveId(item.id)) for (const cat of ['A','B','C','D','E']) out.push(request('/racing/{trackId}/records', 'Racing', { trackId: String(item.id), cat }, `Track records · ${item.name ?? item.id} · ${cat}`));
  if (path === '/faction/chains') add(p.chains, '/faction/{chainId}/chainreport', 'Faction', 'chainId', 'Chain report');
  if (path === '/faction/rankedwars') add(p.rankedwars, '/faction/{rankedWarId}/rankedwarreport', 'Faction', 'rankedWarId', 'Ranked war report');
  if (path === '/faction/crimes') add(p.crimes, '/faction/{crimeId}/crime', 'Faction', 'crimeId', 'Organized crime');
  if (path === '/user/attacks') for (const item of list(p.attacks)) if (typeof item.code === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(item.code)) out.push(request('/torn/attacklog', 'Combat', { log: item.code }, `Attack log · ${item.id}`));
  return mergeRequests(out);
}
export function browserLink(row: ConnectedRequest, parameters = row.parameters) {
  return `#Live%20Feeds?${new URLSearchParams({ section: row.capability.id, ...parameters })}`;
}
export const entryPayload = (entries: Record<string, DataEntry>, path: string, parameters: Record<string,string> = {}) => {
  const c = CAPABILITIES.find(c => c.path === path);
  return c ? object(entries[observationKey(c.id, parameters)]?.observation?.payload) : {};
};
export function inventoryEstimate(inventory: unknown, catalogue: unknown) {
  const items = list(object(object(inventory).inventory).items), prices = new Map(list(object(catalogue).items).map(i => [i.id, object(i.value).market_price]));
  let value = 0, priced = 0;
  for (const row of items) {
    const price = prices.get(row.id);
    if (row.faction_owned === true || typeof row.amount !== 'number' || row.amount < 0 || !Number.isFinite(row.amount) || typeof price !== 'number' || price < 0 || !Number.isFinite(price)) continue;
    value += price * row.amount; priced++;
  }
  return { value: priced ? value : null, priced, total: items.length };
}
export const RELATED_AREAS: Record<string, string> = {
  '/user/{crimeId}/crimes': 'Crimes', '/torn/{crimeId}/subcrimes': 'Crimes',
  '/market/{id}/itemmarket': 'Inventory', '/torn/{ids}/items': 'Inventory',
  '/torn/{stockId}/stocks': 'Investments', '/market/{propertyTypeId}/properties': 'Properties',
  '/market/{propertyTypeId}/rentals': 'Properties', '/property/{id}/property': 'Properties',
  '/racing/{raceId}/race': 'Racing', '/racing/{trackId}/records': 'Racing',
  '/faction/{chainId}/chainreport': 'Faction', '/faction/{rankedWarId}/rankedwarreport': 'Faction',
  '/faction/{crimeId}/crime': 'Faction', '/torn/attacklog': 'Combat',
};
export function restoreRequest(endpointId: string, parameters: Record<string,string>): ConnectedRequest | null {
  const capability = CAPABILITIES.find(c => c.id === endpointId);
  if (!capability || !parameters || Object.values(parameters).some(v => typeof v !== 'string')) return null;
  const exact = CONNECTED_REQUESTS.find(r => observationKey(r.capability.id, r.parameters) === observationKey(endpointId, parameters));
  if (exact) return exact;
  const area = RELATED_AREAS[capability.path];
  return area ? request(capability.path, area, parameters, `${capability.summary} · ${Object.values(parameters).join(', ')}`) : null;
}
