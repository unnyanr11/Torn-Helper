import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { functionError } from '../lib/function-error';
import { dataCategory, observationKey, PERSONAL_REQUESTS, type TornObservation } from '../lib/personal-data';
import TornDataView from './TornDataView';
import KeyDisclosure from './KeyDisclosure';
type Entry = { observation?: TornObservation; previous?: unknown; error?: string };
const wait = (milliseconds: number, signal: AbortSignal) => new Promise<void>(resolve => {
  if (signal.aborted) return resolve();
  const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
  const timer = setTimeout(finish, milliseconds);
  signal.addEventListener('abort', finish, { once: true });
});
export default function MyTorn() {
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [key, setKey] = useState(''), [mode, setMode] = useState('request');
  const [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [error, setError] = useState('');
  const [done, setDone] = useState(0), [category, setCategory] = useState('All'), [search, setSearch] = useState('');
  const control = useRef<AbortController | null>(null);
  const categories = [...new Set(PERSONAL_REQUESTS.map(r => dataCategory(r.capability.path)))];
  useEffect(() => {
    let alive = true;
    // Cache reads are owner-restricted by RLS; no private values go to browser storage.
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!alive || !auth.user) return;
      const { data, error } = await supabase.from('torn_data_cache').select('endpoint_id,parameters,payload,fetched_at').eq('user_id', auth.user.id).gte('fetched_at', new Date(Date.now() - 86400000).toISOString()).order('fetched_at', { ascending: false }).limit(100);
      if (!alive || error || control.current) return;
      const restored: Record<string, Entry> = {};
      for (const row of data ?? []) {
        const parameters = row.parameters as Record<string, string>;
        if (!PERSONAL_REQUESTS.some(r => r.capability.id === row.endpoint_id && observationKey(r.capability.id, r.parameters) === observationKey(row.endpoint_id, parameters))) continue;
        const id = observationKey(row.endpoint_id, parameters);
        if (!restored[id]) restored[id] = { observation: { ...row, parameters, next_parameters: null, cached: true } };
      }
      setEntries(restored);
    })();
    return () => { alive = false; control.current?.abort(); };
  }, []);
  async function collect() {
    const controller = new AbortController(); control.current = controller;
    const secret = key; setKey(''); setBusy(true); setError(''); setDone(0);
    let completed = 0;
    // Profile, bars, battle stats and ALL personal-stat categories arrive first.
    const priority = ['profile', 'bars', 'battlestats', 'personalstats', 'money', 'networth', 'workstats', 'skills', 'cooldowns', 'travel'];
    const requests = [...PERSONAL_REQUESTS].sort((a, b) => {
      const rank = (path: string) => { const index = priority.indexOf(path.split('/')[2]); return index < 0 ? 100 : index; };
      return rank(a.capability.path) - rank(b.capability.path);
    });
    try {
      for (const request of requests) {
        if (controller.signal.aborted) break;
        const id = observationKey(request.capability.id, request.parameters);
        setStatus(`Loading ${request.label}…`);
        let rateRetry = false;
        while (!controller.signal.aborted) {
          const { data, error: failure } = await supabase.functions.invoke('torn-data', { body: { endpoint_id: request.capability.id, parameters: request.parameters, ...(mode === 'request' ? { apiKey: secret } : {}) } });
          if (controller.signal.aborted) break;
          if (failure || data?.error) {
            const message = (await functionError(data, failure)).message;
            if (controller.signal.aborted) break;
            const httpStatus = failure?.context?.status;
            if (httpStatus === 429 && !rateRetry) {
              rateRetry = true; setStatus('Torn request limit reached. Resuming after a 65-second cooldown…');
              await wait(65000, controller.signal); continue;
            }
            setEntries(old => ({ ...old, [id]: { ...old[id], error: message } }));
            // Invalid identity, paused tracking, unavailable encrypted storage and outages
            // affect every request: stop instead of hammering every endpoint.
            if ([401, 409, 429, 503].includes(httpStatus) || /no key|encryption|identity|signed? in|tracking is paused/i.test(message)) throw new Error(message);
          } else {
            setEntries(old => ({ ...old, [id]: { observation: data, previous: old[id]?.observation?.payload } }));
          }
          break;
        }
        if (controller.signal.aborted) break;
        setDone(++completed);
        // Each request-only call also verifies key ownership (three upstream calls).
        // At most 18 section calls/minute leaves room under the 60-cost app budget.
        if (completed < requests.length) await wait(3400, controller.signal);
      }
      if (!controller.signal.aborted) setStatus(`Finished checking ${completed} personal sections. Each result shows its actual collection time.`);
    } catch (failure) {
      if (!controller.signal.aborted) { setError(failure instanceof Error ? failure.message : 'Unable to load Torn data.'); setStatus(`Stopped after ${completed} sections. Successful observations remain available.`); }
    } finally {
      if (control.current === controller && !controller.signal.aborted) setBusy(false);
    }
  }
  function stop() { control.current?.abort(); setBusy(false); setStatus('Collection stopped. Loaded observations remain available.'); }
  const profilePayload = entries[observationKey('v2-user-profile', {})]?.observation?.payload as { profile?: { name?: string; level?: number; rank?: string; title?: string } } | undefined;
  const player = profilePayload?.profile;
  const loaded = Object.values(entries).filter(e => e.observation).length;
  const denied = Object.values(entries).filter(e => e.error).length;
  const visible = PERSONAL_REQUESTS.filter(r => (category === 'All' || dataCategory(r.capability.path) === category) && `${r.label} ${r.capability.summary}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="my-torn">
    <div className="personal-heading"><div><p className="eyebrow">YOUR LIFE IN TORN</p><h2>{player?.name ? `${player.name}’s Torn` : 'Beyond your profile.'}</h2>{player && <p className="personal-identity">Level {player.level ?? 'unknown'} · {player.rank ?? 'Rank unavailable'} · {player.title ?? 'Title unavailable'}</p>}<p>Combat, wealth, working stats, skills, inventory, activity and every available personal statistic — in one workspace.</p></div><span className="personal-count">{PERSONAL_REQUESTS.length}<small>personal sections</small></span></div>
    <article className="card personal-connect"><h3>Connect your complete account</h3><p>Use a Full Access key for the widest coverage. A Custom key needs the relevant selections. Torn may still restrict data by your account or role. We request all personal statistics with category “all”.</p>
      <form onSubmit={event => { event.preventDefault(); void collect(); }}><label>Key to use<select className="nu-input" value={mode} disabled={busy} onChange={e => { setMode(e.target.value); setKey(''); }}><option value="request">Request-only key for this collection</option><option value="stored">Encrypted key saved in Settings</option></select></label>
      {mode === 'request' && <><KeyDisclosure persist={false} session/><label>Torn API key<input className="nu-input" type="password" autoComplete="off" spellCheck={false} value={key} disabled={busy} minLength={16} maxLength={16} required onChange={e => setKey(e.target.value.trim())}/></label></>}
      <p>This loads sensitive personal records, including available money, inventory, logs and messages, into your private workspace. The request-only key stays in memory for this collection, then is discarded. No API key is saved in browser storage.</p>
      <button className="nu-btn" disabled={busy || (mode === 'request' && !/^[A-Za-z0-9]{16}$/.test(key))}>{busy ? 'Collecting your Torn data…' : loaded ? 'Refresh all my data' : 'Load all my Torn data'}</button>{busy && <button className="nu-btn" type="button" onClick={stop}>Stop collection</button>}</form>
      <p>Collection takes several minutes to stay within request limits. Keep this page open. Successful results appear immediately. Long histories load one API page at a time; use “Open section & more pages” to continue.</p>
      {(busy || done > 0) && <progress className="collection-progress" aria-label="Personal sections checked" value={done} max={PERSONAL_REQUESTS.length}/>}
      <p role="status">{status}</p>{error && <p role="alert">{error}</p>}
    </article>
    <div className="personal-summary"><article className="card"><strong>{loaded}</strong><span>Sections with data</span></article><article className="card"><strong>{denied}</strong><span>Sections needing attention</span></article><article className="card"><strong>{PERSONAL_REQUESTS.length - loaded}</strong><span>Without observations</span></article></div>
    <div className="personal-filters"><label>Find a section<input className="nu-input" type="search" placeholder="Battle stats, inventory, money…" value={search} onChange={e => setSearch(e.target.value)}/></label><label>Focus<select className="nu-input" value={category} onChange={e => setCategory(e.target.value)}>{['All', ...categories].map(c => <option key={c}>{c}</option>)}</select></label></div>
    <p>Values are observations, not live estimates. Changes compare two loaded observations while this page stays open. Saved observations are restored for up to 24 hours; cache retention is bounded. Private history is never invented.</p>
    <details className="card personal-lookups"><summary>More personal detail: crime statistics and individual trades</summary><p>These endpoints require a specific crime ID or trade ID. Choose a detailed lookup in the data browser; its result uses the same rich cards. Trade history and the personal-statistics section above provide the available summary records.</p><p><a className="nu-btn" href="#Live%20Feeds?section=v2-user-%7BcrimeId%7D-crimes">Detailed crime statistics ↗</a> <a className="nu-btn" href="#Live%20Feeds?section=v2-user-%7BtradeId%7D-trade">Individual trade details ↗</a></p></details>
    <div className="personal-sections">{visible.map(request => {
      const entry = entries[observationKey(request.capability.id, request.parameters)];
      const link = `#Live%20Feeds?section=${encodeURIComponent(request.capability.id)}&${new URLSearchParams(request.parameters)}`;
      return <article className="card personal-section" key={observationKey(request.capability.id, request.parameters)}><header><div><small>{dataCategory(request.capability.path)}</small><h3>{request.label}</h3></div><span className={`section-state ${entry?.error ? 'needs-attention' : ''}`}>{entry?.error ? 'Needs attention' : entry?.observation ? 'Observed' : 'Not loaded'}</span></header>
        {entry?.error && <p role="status">{entry.error}{entry.observation && ' Showing the previous successful observation below.'}</p>}
        {entry?.observation ? <><p className="observation-time">Observed {new Date(entry.observation.fetched_at).toLocaleString()}</p><TornDataView value={entry.observation.payload} previous={entry.previous}/></> : <p className="data-empty">{entry?.error ? 'No successful observation for this section.' : 'Load your account to see this section. Nothing has been estimated or filled in.'}</p>}
        <a className="data-section-link" href={link}>Open section & more pages ↗</a>
      </article>;
    })}</div>{!visible.length && <p>No sections match your search.</p>}
  </section>;
}
