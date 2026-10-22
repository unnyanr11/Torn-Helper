import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invokeTornData } from '../lib/torn-data-client';
import { useSavedObservations } from '../hooks/useSavedObservations';
import { observationsKey, mergeObservation, refreshAfter, nextRefreshPath, type UpdateMode } from '../lib/observation-cache';
import { isRecent } from '../lib/observation-cache';
import { functionError } from '../lib/function-error';
import { observationKey } from '../lib/personal-data';
import { AREAS, browserLink, CONNECTED_REQUESTS, mergeRequests, relatedRequests, restoreRequest, type ConnectedRequest, type DataEntry } from '../lib/connected-data';
import { collectConnected } from '../lib/connected-collection';
import TornDataView from './TornDataView';
import KeyDisclosure from './KeyDisclosure';
import ConnectedInsights from './ConnectedInsights';
import HistoryExplorer from './HistoryExplorer';
import HomeDashboard from './HomeDashboard';
import WorkspaceWelcome from './WorkspaceWelcome';
import { useWorkspaceFocus } from '../hooks/useWorkspaceFocus';
import { ESSENTIAL_PATHS, homeEntry } from '../lib/home-dashboard';
import { CAPABILITIES } from '../api/capabilities';
import type { TornObservation } from '../lib/personal-data';
import { syncEnergyLogs, type EnergyLogCoverage } from '../lib/energy-log-sync';
const wait = (milliseconds: number, signal: AbortSignal) => new Promise<void>(resolve => {
  if (signal.aborted) return resolve();
  const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
  const timer = setTimeout(finish, milliseconds);
  signal.addEventListener('abort', finish, { once: true });
});
const initialArea = () => { const area = new URLSearchParams(location.hash.split('?')[1] ?? '').get('area'); return area && (area==='All'||AREAS.includes(area)) ? area : 'Personal'; };
export default function MyTorn({accountId}:{accountId?:string}) {
  const focus=useWorkspaceFocus(accountId);
  const client = useQueryClient();
  const saved=useSavedObservations(accountId),entries=saved.data??{};
  const setEntries=(update:(old:Record<string,DataEntry>)=>Record<string,DataEntry>)=>client.setQueryData<Record<string,DataEntry>>(observationsKey(accountId??''),old=>update(old??{}));
  const [target,setTarget]=useState('essentials'),[updates,setUpdates]=useState<UpdateMode>('off');
  const keyInput=useRef<HTMLInputElement>(null),refreshForm=useRef<HTMLElement>(null);
  const latest=useRef<()=>void>(()=>{});
  const [requests, setRequests] = useState(CONNECTED_REQUESTS);
  const [selected, setSelected] = useState(() => { const area = initialArea(); return area === 'All' ? AREAS : [area]; });
  const [key, setKey] = useState(''), [mode, setMode] = useState('request');
  const [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [error, setError] = useState('');
  const [done, setDone] = useState(0), [total, setTotal] = useState(0), [area, setArea] = useState(initialArea), [search, setSearch] = useState('');
  const [showUnloaded, setShowUnloaded] = useState(false);
  const [energyCoverage,setEnergyCoverage]=useState<EnergyLogCoverage>();
  const control = useRef<AbortController | null>(null),automaticControl=useRef<AbortController|null>(null);
  useEffect(() => {
    const route = () => { const next = initialArea(); setArea(next); setSearch(''); if (next !== 'All') setSelected([next]); };
    window.addEventListener('hashchange', route);
    return () => { control.current?.abort(); window.removeEventListener('hashchange', route); };
  }, []);
  useEffect(()=>{
    const rows=Object.values(entries).flatMap(entry=>{const observation=entry.observation;if(!observation)return [];const row=restoreRequest(observation.endpoint_id,observation.parameters);return row?[row,...relatedRequests(row,observation.payload)]:[];});
    setRequests(old=>mergeRequests([...old,...rows]));
  },[saved.data]);
  useEffect(()=>{const tick=()=>{if((document.visibilityState!=='visible'||navigator.onLine===false)&&automaticControl.current){automaticControl.current.abort();automaticControl.current=null;setStatus('Automatic updates paused while this tab is hidden or offline.');}else latest.current();};const timer=setInterval(tick,15000);document.addEventListener('visibilitychange',tick);window.addEventListener('online',tick);window.addEventListener('offline',tick);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',tick);window.removeEventListener('online',tick);window.removeEventListener('offline',tick);};},[]);
  latest.current=()=>{
    if(updates==='off'||mode!=='stored'||control.current&&!control.current.signal.aborted)return;
    const path=nextRefreshPath(entries,updates,document.visibilityState==='visible',navigator.onLine!==false);
    if(path)void collect('single',path,true);
  };
  async function collect(kind:'essentials'|'selected'|'single'='selected',path?:string,automatic=false) {
    if (control.current && !control.current.signal.aborted) return;
    if(mode==='request'&&!/^[A-Za-z0-9]{16}$/.test(key))return;
    const controller = new AbortController(); control.current = controller;automaticControl.current=automatic?controller:null;
    const secret = key; setKey(''); setBusy(true); setError(''); setDone(0); setShowUnloaded(false);
    const priority = ['profile', 'bars', 'battlestats', 'personalstats', 'money', 'networth', 'workstats', 'skills', 'cooldowns', 'travel'];
    const queue = CONNECTED_REQUESTS.filter(r => kind==='single'?r.capability.path===path:kind==='essentials'?ESSENTIAL_PATHS.includes(r.capability.path)&&!isRecent(homeEntry(entries,r.capability.path)?.observation,refreshAfter(r.capability.path,'active',homeEntry(entries,r.capability.path)?.observation?.payload)):r.areas.some(a => selected.includes(a))).sort((a, b) => {
      const rank = (r: ConnectedRequest) => { const index = r.capability.group === 'user' ? priority.indexOf(r.capability.path.split('/')[2]) : -1; return index < 0 ? 100 : index; };
      return rank(a) - rank(b);
    });
    setTotal(queue.length);
    if(!queue.length){setStatus('Your essentials were checked recently. Reusing saved observations without a Torn request.');setBusy(false);control.current=null;return;}
    try {
      const result = await collectConnected({ requests: queue, areas: selected, signal: controller.signal, pause: wait,
        fetch: async row => {
          const r = await invokeTornData(client, { body: { endpoint_id: row.capability.id, parameters: row.parameters, ...(mode === 'request' ? { apiKey: secret } : {}) },signal:controller.signal });
          if (r.error || r.data?.error){const problem=(await functionError(r.data,r.error)).message;if(automatic)throw new Error(problem);return {error:problem,status:r.error?.context?.status};}
          return { observation: r.data };
        },
        onResult: (row, result) => {
          const id = observationKey(row.capability.id, row.parameters);
          setEntries(old => result.observation?mergeObservation(old,result.observation):({...old,[id]:{...old[id],error:result.error}}));
          if(automatic&&result.error){setUpdates('off');setError(`Automatic updates paused: ${result.error}`);}
        },
        onDiscover: rows => setRequests(old => mergeRequests([...old, ...rows])),
        onProgress: (count, size, message) => { setDone(count); setTotal(size); setStatus(message); },
      });
      if (!result.stopped) setStatus(kind==='single'?'Section checked. Other saved sections were reused.':kind==='essentials'?`Checked ${result.done} essential sections. Your daily overview is updated below.`:`Finished checking ${result.done} sections. Open connected data below to view results.`);
      if (!controller.signal.aborted) await Promise.all([client.invalidateQueries({ queryKey: ['personal-history'] }), client.invalidateQueries({ queryKey: ['personal-history-start'] })]);
    } catch (failure) {
      if (!controller.signal.aborted) { if(automatic)setUpdates('off');setError(failure instanceof Error ? failure.message : 'Unable to load Torn data.'); setStatus('Collection stopped. Successful observations remain available.'); }
    } finally { if(automaticControl.current===controller)automaticControl.current=null;if(control.current===controller){control.current=null;setBusy(false);} }
  }
  async function updateEnergy(kind:'bars'|'logs') {
    if(control.current&&!control.current.signal.aborted || (mode==='request'&&!/^[A-Za-z0-9]{16}$/.test(key)))return;
    const controller=new AbortController();control.current=controller;
    const secret=key;setKey('');setBusy(true);setError('');setDone(0);setTotal(kind==='bars'?1:2);setStatus('Checking energy…');
    const save=(observation:TornObservation)=>setEntries(old=>mergeObservation(old,observation));
    const fetch=async(path:string,parameters:Record<string,string>):Promise<TornObservation>=>{
      const endpoint=CAPABILITIES.find(c=>c.path===path)!;
      const response=await invokeTornData(client,{body:{endpoint_id:endpoint.id,parameters,...(mode==='request'?{apiKey:secret}:{})},signal:controller.signal});
      if(response.error||response.data?.error)throw new Error((await functionError(response.data,response.error)).message);
      if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
      return response.data;
    };
    try {
      if(kind==='bars'){
        const observation=await fetch('/user/bars',{timestamp:String(Math.floor(Date.now()/1000))});save(observation);setEnergyCoverage(undefined);setDone(1);setStatus('Energy baseline confirmed. Refill ticks now update locally without API calls.');
      }else{
        const baseline=homeEntry(entries,'/user/bars')?.observation?.fetched_at;
        if(!baseline)throw new Error('Refresh energy to establish a starting value first.');
        const previous=energyCoverage?.baseline===baseline&&energyCoverage.complete?energyCoverage:undefined;
        // Mark incomplete before fetching: a failed or cancelled multi-page check must not appear complete.
        setEnergyCoverage({baseline,from:Math.floor(Date.parse(baseline)/1000),to:0,complete:false,pages:0});
        let pages=0;
        const coverage=await syncEnergyLogs({baseline,since:previous?.to,signal:controller.signal,fetch:parameters=>fetch('/user/log',parameters),pause:wait,onPage:observation=>{save(observation);setDone(++pages);}});
        setEnergyCoverage({...coverage,from:previous&&previous.to>=coverage.from?previous.from:coverage.from});
        setStatus(coverage.complete?'Recent logs checked. Later actions require another log check.':'More log pages remain. Refresh energy once to establish a new baseline with fewer API calls.');
      }

    }catch(failure){if(!controller.signal.aborted){setError(failure instanceof Error?failure.message:'Unable to update energy.');setStatus('Energy check stopped. The last confirmed value remains available.');}}
    finally{if(automaticControl.current===controller)automaticControl.current=null;if(control.current===controller){control.current=null;setBusy(false);}}
  }
  function stop() { control.current?.abort(); control.current=null;setUpdates('off');setBusy(false); setStatus('Collection stopped. Loaded observations remain available.'); void client.invalidateQueries({ queryKey: ['personal-history'] }); }
  function refreshSection(path:string){setTarget(path);if(mode==='stored'||/^[A-Za-z0-9]{16}$/.test(key))void collect('single',path);else{setStatus('Enter your request-only key below to refresh this section.');refreshForm.current?.scrollIntoView?.({block:'center',behavior:'smooth'});keyInput.current?.focus();}}
  const player = (homeEntry(entries,'/user/profile')?.observation?.payload as any)?.profile;
  const loaded = Object.values(entries).filter(e => e.observation).length, denied = Object.values(entries).filter(e => e.error).length;
  const visible = requests.filter(r => (area === 'All' || r.areas.includes(area)) && `${r.label} ${r.capability.summary}`.toLowerCase().includes(search.toLowerCase()) && (showUnloaded || entries[observationKey(r.capability.id, r.parameters)]));
  return <section className="my-torn">
    <h2>{player?.name ? `${player.name}’s dashboard` : 'My dashboard'}</h2><p>Your daily overview and a useful place to start.</p>
    <WorkspaceWelcome focus={focus.focus} onChoose={focus.choose} storageError={focus.storageError}/>
    <HomeDashboard entries={entries} energyCoverage={energyCoverage} onRefresh={refreshSection} busy={busy}/>
    {saved.isLoading&&<p role="status">Loading your saved observations…</p>}{saved.isError&&<p role="alert">Saved observations could not be restored. <button type="button" className="nu-btn" onClick={()=>void saved.refetch()}>Retry saved data</button></p>}
    <article ref={refreshForm} className="card personal-connect"><h3>Refresh essentials</h3><p>Saved data appears first. Refresh only what you need; recent essentials are reused.</p>
      <form onSubmit={event=>{event.preventDefault();void collect(target==='essentials'?'essentials':'single',target);}}>
       <label>Key to use<select className="nu-input" value={mode} disabled={busy} onChange={e=>{setMode(e.target.value);setUpdates('off');setKey('');}}><option value="request">Use a key for this refresh</option><option value="stored">Use my encrypted key from Settings</option></select></label>
       {mode==='request'&&<><p>Your key is sent to this platform’s backend and the official Torn API for this refresh, then discarded. It is never saved in browser storage.</p><details><summary>Key privacy and access</summary><KeyDisclosure persist={false} session/></details><label>Torn API key<input className="nu-input" ref={keyInput} type="password" autoComplete="off" spellCheck={false} value={key} disabled={busy} minLength={16} maxLength={16} required onChange={e=>setKey(e.target.value.trim())}/></label></>}
       <label>What to refresh<select className="nu-input" disabled={busy} value={target} onChange={e=>setTarget(e.target.value)}><option value="essentials">Only essentials that need updating</option><option value="/user/bars">Bars only</option><option value="/user/cooldowns">Cooldowns only</option><option value="/user/travel">Travel only</option><option value="/user/profile">Profile only</option></select></label>
       <label>Automatic updates<select className="nu-input" value={updates} disabled={mode!=='stored'} onChange={e=>{setUpdates(e.target.value as UpdateMode);if(e.target.value==='off'){automaticControl.current?.abort();setStatus('Automatic updates turned off.');}}}><option value="off">Off · refresh myself</option><option value="economy">Economy · about every 5 minutes while visible</option><option value="active">Active · bars and cooldowns about every minute</option></select></label><p>Requires an encrypted key saved in Settings. Updates pause when this page is hidden or offline, and stop after an error. Profile checks run less often; travel checks speed up during a recorded flight. Request-only keys are never retained.</p>
       <button className="nu-btn" disabled={busy||(mode==='request'&&!/^[A-Za-z0-9]{16}$/.test(key))}>{busy?'Refreshing…':target==='essentials'?'Refresh essentials':'Refresh selected section'}</button>{busy&&<button className="nu-btn" type="button" onClick={stop}>Stop refresh</button>}
       <details><summary>Energy timer and activity logs</summary><p>Refill ticks use the last confirmed timing and make no API calls. Sync logs to apply explicit energy gains and costs. Notifications alone do not confirm an amount.</p><p>Logs require Full Access or a suitable Custom key. Restricted log categories can omit actions; this remains an estimate. A check loads at most two pages, then recommends a new baseline if history is incomplete.</p>
        <button className="nu-btn" type="button" disabled={busy||(mode==='request'&&!/^[A-Za-z0-9]{16}$/.test(key))} onClick={()=>void updateEnergy('bars')}>Refresh energy baseline</button>
        <button className="nu-btn" type="button" disabled={busy||!homeEntry(entries,'/user/bars')?.observation||(mode==='request'&&!/^[A-Za-z0-9]{16}$/.test(key))} onClick={()=>void updateEnergy('logs')}>Sync energy logs</button>
       </details>
       <details open={new URLSearchParams(location.hash.split('?')[1]??'').has('area')}><summary>Load more data and advanced options</summary><p>Choose a group for detailed records. All groups can take 10–20 minutes. Related detail is limited to 120 extra requests, with further records available individually.</p>
        <label>Data group<select className="nu-input" aria-label="Data group" disabled={busy} value={selected.length===AREAS.length?'All':selected[0]??'Personal'} onChange={e=>{const next=e.target.value;setSelected(next==='All'?AREAS:[next]);setArea(next);setSearch('');}}><option value="All">All groups (takes longer)</option>{AREAS.map(a=><option key={a}>{a}</option>)}</select></label>
        <p>This collection can include private money, inventory, logs, messages, faction and company records, depending on the group and your key permissions.</p>
        <button className="nu-btn" type="button" disabled={busy||!selected.length||(mode==='request'&&!/^[A-Za-z0-9]{16}$/.test(key))} onClick={()=>void collect('selected')}>{selected.length===AREAS.length?'Refresh all groups':'Refresh selected group'}</button>
       </details>
      </form>
      {(busy||done>0)&&<progress className="collection-progress" aria-label="Connected sections checked" value={done} max={Math.max(1,total)}/>}
      <p role="status">{status}</p>{error&&<p role="alert">{error}</p>}
    </article>
    <details className="card home-connected" open={new URLSearchParams(location.hash.split('?')[1]??'').has('area')}><summary>All connected data · {loaded} sections with observations</summary>
    {loaded>0&&<ConnectedInsights entries={entries}/>}
    <details className="card"><summary>Trends and history settings</summary><HistoryExplorer/></details>
    <div className="personal-summary"><article className="card"><strong>{loaded}</strong><span>Sections with data</span></article><article className="card"><strong>{denied}</strong><span>Sections needing attention</span></article><article className="card"><strong>{requests.length}</strong><span>Known sections and lookups</span></article></div>
    <div className="personal-filters"><label>Show section<select className="nu-input" value={search} onChange={e=>setSearch(e.target.value)}><option value="">All sections in this group</option>{[...new Set(requests.filter(r=>area==='All'||r.areas.includes(area)).map(r=>r.label))].sort().map(name=><option key={name}>{name}</option>)}</select></label></div>
    <label><input type="checkbox" checked={showUnloaded} onChange={e => setShowUnloaded(e.target.checked)}/> Show sections without observations</label>
    <p>Observations show their collection time. Refresh changes compare actual observations in memory. Only the latest 100 requests are retained in the private cache for up to 24 hours; opted-in numeric history is stored separately.</p>
    <div className="personal-sections">{visible.map(row => {
      const id = observationKey(row.capability.id, row.parameters), entry = entries[id];
      return <article className="card personal-section" key={id}><header><div><small>{row.areas.join(' · ')}</small><h3>{row.label}</h3></div><span className={`section-state ${entry?.error ? 'needs-attention' : ''}`}>{entry?.error ? 'Needs attention' : entry?.observation ? 'Observed' : 'Not loaded'}</span></header>
        {entry?.error && <p role="status">{entry.error}{entry.observation && ' Showing the last successful observation below.'}</p>}
        {entry?.observation ? <><p className="observation-time">Observed {new Date(entry.observation.fetched_at).toLocaleString()}</p>{entry.observation.history_warning && <p role="status">{entry.observation.history_warning}</p>}<TornDataView value={entry.observation.payload} previous={entry.previous}/><RelatedLinks row={row} payload={entry.observation.payload}/></> : <p className="data-empty">No successful observation yet. Load this group or use its individual lookup.</p>}
        <a className="data-section-link" href={browserLink(row)}>Open individual section ↗</a>{entry?.observation?.next_parameters && <> · <a className="data-section-link" href={browserLink(row, entry.observation.next_parameters)}>More history pages ↗</a></>}
      </article>;
    })}</div>{!visible.length && <p>No observations match. Load a group or enable “Show sections without observations”.</p>}
    </details>
  </section>;
}
function RelatedLinks({ row, payload }: { row: ConnectedRequest; payload: unknown }) {
  const [shown,setShown] = useState(20), related = relatedRequests(row,payload);
  return related.length ? <details><summary>{related.length} related detail lookups</summary><ul>{related.slice(0,shown).map(r => <li key={observationKey(r.capability.id,r.parameters)}><a href={browserLink(r)}>{r.label} ↗</a></li>)}</ul>{shown < related.length && <button className="nu-btn" onClick={() => setShown(n => n + 20)}>Show 20 more lookups</button>}</details> : null;
}
