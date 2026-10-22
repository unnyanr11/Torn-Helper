import { entryPayload, inventoryEstimate, list, object, type DataEntry } from '../lib/connected-data';
export default function ConnectedInsights({ entries }: { entries: Record<string, DataEntry> }) {
  const get = (path: string) => entryPayload(entries, path);
  const inventory = inventoryEstimate(get('/user/inventory'), get('/torn/items'));
  const holdings = list(get('/user/stocks').stocks), prices = new Map(list(get('/torn/stocks').stocks).map(s => [s.id, object(s.market).price]));
  let portfolio = 0, priced = 0;
  for (const h of holdings) { const price = prices.get(h.id); if (typeof price === 'number' && Number.isFinite(price) && price >= 0 && typeof h.shares === 'number' && Number.isFinite(h.shares) && h.shares >= 0) { portfolio += price * h.shares; priced++; } }
  const education = object(get('/user/education').education), courses = list(get('/torn/education').education).flatMap(e => list(e.courses));
  const complete = new Set(Array.isArray(education.complete) ? education.complete : []);
  const player = object(get('/user/profile').profile), attacks = list(get('/user/attacks').attacks).filter(a => typeof player.id === 'number' && object(a.attacker).id === player.id);
  const won = attacks.filter(a => ['Attacked','Mugged','Hospitalized','Special'].includes(a.result)).length;
  return <section className="connected-insights"><h3>Connected insights</h3><div className="personal-summary">
    <article className="card"><span>Inventory estimate</span><strong>{inventory.value === null ? '—' : `$${inventory.value.toLocaleString()}`}</strong><p>{inventory.priced} of {inventory.total} returned inventory rows priced. Uses catalogue market prices; excludes faction-owned items. This is not a guaranteed sale value.</p></article>
    <article className="card"><span>Stock holdings estimate</span><strong>{priced ? `$${portfolio.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}</strong><p>{priced} of {holdings.length} returned holdings priced using shares × observed market price, before fees. Quotes and holdings may have different observation times.</p></article>
    <article className="card"><span>Education progress</span><strong>{Array.isArray(education.complete) ? complete.size : '—'}</strong><p>Completed courses reported by Torn. {courses.length ? `${courses.filter(c => !complete.has(c.id)).length} catalogue courses have no completion recorded.` : 'Load the education catalogue for remaining courses.'}</p></article>
    <article className="card"><span>Outgoing combat outcomes</span><strong>{attacks.length ? `${won} / ${attacks.length}` : '—'}</strong><p>Successful attacks among returned outgoing records (attacked, mugged, hospitalized or special). This sample is not your lifetime win rate.</p></article>
  </div>{courses.length > 0 && <details className="card"><summary>Education checklist</summary><ul>{courses.map(c => <li key={c.id}>{complete.has(c.id) ? '✓ Completed' : Array.isArray(education.complete) ? '○ Not recorded complete' : 'Unknown completion'} · {c.name}</li>)}</ul></details>}</section>;
}
