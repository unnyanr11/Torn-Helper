import { useState } from 'react';
import { dataLabel, numericChange } from '../lib/personal-data';
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function formatted(value: unknown, name: string) {
  if (value === null || value === undefined) return 'Not provided';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (/^(timestamp|signed_up|fetched_at|last_update|started|ended)$/.test(name) && value > 1e9 && value < 1e11) return new Date(value * 1000).toLocaleString();
    return value.toLocaleString(undefined, { maximumFractionDigits: 8 });
  }
  return String(value).replace(/<[^>]*>/g, ' ').trim() || 'Empty';
}
export default function TornDataView({ value, previous, name = 'Details', depth = 0 }: { value: unknown; previous?: unknown; name?: string; depth?: number }) {
  const [shown, setShown] = useState(25);
  if (Array.isArray(value)) {
    if (!value.length) return <p className="data-empty">No records returned.</p>;
    return <div className="data-records"><PriceHistory value={value}/><small>{value.length.toLocaleString()} records in this response</small>{value.slice(0, shown).map((row, index) => <details key={index} open={index < 3 && depth < 2}><summary>{record(row) ? String(row.name ?? row.title ?? row.type ?? row.id ?? `Record ${index + 1}`).replace(/<[^>]*>/g, ' ') : `Record ${index + 1}`}</summary><TornDataView value={row} name={String(index)} depth={depth + 1}/></details>)}{shown < value.length && <button className="nu-btn" onClick={() => setShown(n => n + 25)}>Show 25 more ({value.length - shown} remaining)</button>}</div>;
  }
  if (!record(value)) {
    const delta = numericChange(value, previous);
    return <span className="data-value">{formatted(value, name)}{delta !== null && delta !== 0 && <small className="data-delta">{delta > 0 ? '+' : ''}{delta.toLocaleString()} since previous observation</small>}</span>;
  }
  const entries = Object.entries(value).filter(([key]) => !key.startsWith('_'));
  const simple = entries.filter(([, v]) => v === null || typeof v !== 'object');
  const nested = entries.filter(([, v]) => v !== null && typeof v === 'object');
  const old = record(previous) ? previous : {};
  const current = value.current, max = value.maximum ?? value.max;
  return <div className="data-content">{!entries.length && <p className="data-empty">No values returned.</p>}{typeof current === 'number' && typeof max === 'number' && max > 0 && <div className="data-bar"><progress aria-label={dataLabel(name)} max={max} value={Math.max(0, Math.min(current, max))}/><span>{current.toLocaleString()} / {max.toLocaleString()}</span></div>}
    {!!simple.length && <dl className="data-metrics">{simple.map(([key, item]) => <div key={key}><dt>{dataLabel(key)}</dt><dd><TornDataView value={item} previous={old[key]} name={key} depth={depth + 1}/></dd></div>)}</dl>}
    {nested.map(([key, item]) => depth < 1 ? <section className="data-group" key={key}><h4>{dataLabel(key)}</h4><TornDataView value={item} previous={old[key]} name={key} depth={depth + 1}/></section> : <details key={key} open={depth < 2}><summary>{dataLabel(key)}{Array.isArray(item) ? ` · ${item.length} records` : ''}</summary><TornDataView value={item} previous={old[key]} name={key} depth={depth + 1}/></details>)}
  </div>;
}

function PriceHistory({ value }: { value: unknown[] }) {
  const points = value.filter((v): v is { timestamp: number; price: number } => record(v) && typeof v.timestamp === 'number' && Number.isFinite(v.timestamp) && v.timestamp > 1e9 && v.timestamp < 1e11 && typeof v.price === 'number' && Number.isFinite(v.price)).sort((a,b) => a.timestamp - b.timestamp);
  if (points.length < 2) return null;
  const first = points[0], last = points[points.length - 1];
  const min = Math.min(...points.map(p => p.price)), range = Math.max(...points.map(p => p.price)) - min || 1;
  const duration = last.timestamp - first.timestamp || 1;
  const path = points.map((p,i) => `${i ? 'L' : 'M'}${10 + (p.timestamp - first.timestamp) / duration * 580},${170 - (p.price - min) / range * 150}`).join(' ');
  return <figure style={{ margin: '1rem 0' }}><figcaption>Returned price history · {points.length} observations</figcaption><svg className="observed-price-chart" role="img" aria-label="Stock prices by returned observation time" viewBox="0 0 600 190"><path d={path} fill="none" stroke="var(--accent)" strokeWidth="2"/>{points.map((p,i) => <circle key={i} cx={10 + (p.timestamp - first.timestamp) / duration * 580} cy={170 - (p.price - min) / range * 150} r="2" fill="var(--accent)"><title>{new Date(p.timestamp * 1000).toLocaleString()}: ${p.price.toLocaleString()}</title></circle>)}</svg><small>{new Date(first.timestamp * 1000).toLocaleString()} → {new Date(last.timestamp * 1000).toLocaleString()}</small></figure>;
}
