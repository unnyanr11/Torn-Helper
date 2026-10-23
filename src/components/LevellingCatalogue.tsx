import { useEffect,useMemo,useRef,useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { STARTER_TARGETS,LEVELLING_SNAPSHOT } from '../data/levelling-targets';
import { filterStarterTargets,targetAvailability,targetObservation,nextTargetChecks,mergeTargetObservations,targetInactive,type TargetObservation } from '../lib/levelling';
import { useTornChoices } from '../hooks/useTornChoices';
import { createTravelClient } from '../lib/travel-client';
import { functionError } from '../lib/function-error';
import { invokeTornData } from '../lib/torn-data-client';
import { useTornConnection } from '../hooks/useTornConnection';
import TornConnectionPanel from './TornConnectionPanel';
export default function LevellingCatalogue(){
 const cache=useTornChoices(),client=useQueryClient(),connection=useTornConnection();
 const preferences=client.getQueryData<{maximum:number;availability:string;sort:string;inactive?:string}>(['levelling-preferences']);
 const [maximum,setMaximum]=useState(preferences?.maximum??1000),[availability,setAvailability]=useState(preferences?.availability==='Recently active'||preferences?.availability==='Activity unknown'?'All':preferences?.availability??'All'),[sort,setSort]=useState(preferences?.sort??'stats'),[inactive,setInactive]=useState(preferences?.inactive??(preferences?.availability==='Recently active'?'recent':preferences?.availability==='Activity unknown'?'unknown':'any'));
 useEffect(()=>{client.setQueryData(['levelling-preferences'],{maximum,availability,sort,inactive});},[maximum,availability,sort,inactive]);
 const [chosenMode,setMode]=useState<string|null>(null),[key,setKey]=useState(''),[memory,setMemory]=useState(false),[busy,setBusy]=useState(false),[done,setDone]=useState(0),[total,setTotal]=useState(0),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [observations,setObservations]=useState<Record<number,TargetObservation>>({}),[now,setNow]=useState(Date.now),[selected,setSelected]=useState<number|null>(null);
 const control=useRef<AbortController|null>(null),live=useRef(true);
 const fetchProfile=useMemo(()=>createTravelClient(async(endpoint_id,parameters,apiKey,signal)=>{
  const r=await invokeTornData(client,{body:{endpoint_id,parameters,...(apiKey===undefined?{}:{apiKey})},signal});
  if(r.error||r.data?.error){const e=await functionError(r.data,r.error);throw Object.assign(e,{status:r.error?.context?.status??503});}return r.data;
 }),[]);
 useEffect(()=>{live.current=true;const timer=setInterval(()=>setNow(Date.now()),15000);return()=>{live.current=false;clearInterval(timer);control.current?.abort();};},[]);
 useEffect(()=>{
  const restored:Record<number,TargetObservation>={};
  for(const row of cache.data??[]){const id=(row.payload as any)?.profile?.id;if(!STARTER_TARGETS.some(t=>t.id===id)||!row.fetched_at||restored[id])continue;
   try{restored[id]=targetObservation(id,{endpoint_id:row.endpoint_id,payload:row.payload,fetched_at:row.fetched_at,parameters:{id:String(id)},next_parameters:null});}catch{}
  }
  setObservations(old=>mergeTargetObservations(old,restored));
 },[cache.data]);
 const mode=chosenMode??(connection.status.data?.hasStoredKey?'stored':'request');
 const ready=!!cache.owner&&(mode!=='stored'||connection.status.data?.hasStoredKey!==false)&&(mode==='stored'||/^[A-Za-z0-9]{16}$/.test(key));
 const visible=filterStarterTargets(STARTER_TARGETS,observations,maximum,availability,sort,now,inactive);
 const sourceRows=STARTER_TARGETS.filter(t=>t.reportedTotal<=maximum);
 const nextIds=nextTargetChecks(sourceRows,observations,8,now),availableCount=sourceRows.filter(t=>targetAvailability(observations[t.id],now)==='Available').length,unchecked=sourceRows.filter(t=>!observations[t.id]).length;
 async function refresh(ids=nextTargetChecks(sourceRows,observations,8,Date.now())){
  if(busy||!ready||!ids.length)return;control.current?.abort();const controller=new AbortController();control.current=controller;setBusy(true);setDone(0);setTotal(ids.length);setMessage('');setError('');const supplied=mode==='request'?key:undefined;if(!memory)setKey('');let count=0,success=0,failures=0;
  try{
   for(const id of ids){
    if(controller.signal.aborted)break;
    try{const data=await fetchProfile('/user/{id}/profile',{id:String(id)},supplied,controller.signal);if(controller.signal.aborted)break;
     const parsed=targetObservation(id,data);setObservations(old=>mergeTargetObservations(old,{[id]:parsed}));setNow(Date.now());success++;
    }catch(e){if(controller.signal.aborted)break;failures++;const status=(e as any)?.status;if([401,409,429].includes(status)||status>=500)throw e;setMessage(`Some targets could not be checked: ${e instanceof Error?e.message:'Profile unavailable'}`);}
    setDone(++count);
   }
   if(!controller.signal.aborted)setMessage(`Loaded ${success} of ${ids.length} target profiles${failures?`; ${failures} failed`:count<ids.length?`; ${ids.length-count} not checked`: ''}. Checks stay recent for five minutes. Recheck before attacking; status can change at any time.`);
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Unable to refresh targets.');}
  finally{if(live.current&&control.current===controller&&!controller.signal.aborted)setBusy(false);}
 }
 function stop(){control.current?.abort();setBusy(false);setMessage('Refresh stopped. Checked profiles remain visible.');}
 const detail=selected?observations[selected]:undefined;
 return <article className="card built-in-targets"><h3>Ready-made levelling lists</h3><p>{STARTER_TARGETS.length} real community-listed targets are included. Select a list below; no list creation or manual IDs are required.</p>
  <div className="travel-fields"><label>Built-in list<select className="nu-input" value={maximum} disabled={busy} onChange={e=>setMaximum(Number(e.target.value))}><option value="100">Starter · reported total up to 100</option><option value="500">Progressing · reported total up to 500</option><option value="1000">All starter targets · reported total up to 1,000</option></select></label>
  <label>Status filter<select className="nu-input" value={availability} onChange={e=>setAvailability(e.target.value)}>{['All','Available','Not checked','Check again','Hospital','Jail','Traveling','Abroad','Federal'].map(s=><option key={s} value={s}>{s==='Available'?'Okay · checked within 5 minutes':s}</option>)}</select></label>
  <label>Inactivity<select className="nu-input" value={inactive} onChange={e=>setInactive(e.target.value)}><option value="any">Any activity · show all players</option><option value="recent">Active within 30 days</option><option value="unknown">Activity unknown</option>{[7,30,90].map(days=><option key={days} value={String(days)}>No observed action for {days}+ days</option>)}</select></label>
  <label>Sort by<select className="nu-input" value={sort} onChange={e=>setSort(e.target.value)}><option value="stats">Lowest reported battle total</option><option value="level">Highest level</option><option value="name">Name</option></select></label></div>
  <p>Reported battle totals are community claims, not current private stats from Torn. Live status starts as “Not checked”. No target is guaranteed to be an easy win.</p>
  <div className="personal-summary" aria-label="Target check summary"><article><span>Targets in this list</span><strong>{sourceRows.length}</strong></article><article><span>Okay at a recent check</span><strong>{availableCount}</strong></article><article><span>Not checked yet</span><strong>{unchecked}</strong></article></div>
  {!availableCount&&<p role="status">{unchecked===sourceRows.length?'Targets are loaded, but their current status has not been checked.':'No targets have a recent Okay observation. Older checks may need refreshing; hospital, travel and other states are shown in the list.'} Availability is based on collected profiles, not a guarantee that someone can be attacked now.</p>}
  <details open={busy||!availableCount}><summary>Refresh live target status</summary><TornConnectionPanel mode={mode} onMode={value=>{setMode(value);setMemory(false);}} keyValue={key} onKey={setKey} memory={memory} onMemory={setMemory} disabled={busy}/>
  <button className="nu-btn" disabled={busy||!ready||!nextIds.length} onClick={()=>void refresh()}>{busy?'Checking targets…':`Check next ${nextIds.length} unchecked / older targets`}</button><button className="nu-btn" disabled={busy||!ready} onClick={()=>void refresh(sourceRows.map(t=>t.id))}>Recheck all {sourceRows.length} targets</button>{busy&&<button className="nu-btn" onClick={stop}>Stop refresh</button>}
  <p>Requests are spaced to respect Torn quotas. A full list takes about two minutes. “Okay” checks remain recent for five minutes. Inactivity is a separate optional filter; private battle stats remain unknown. Short batches check up to eight profiles, prioritizing unchecked and oldest observations.</p>
  </details>
  {busy&&<progress aria-label="Levelling profiles checked" max={Math.max(1,total)} value={done}/>}{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
  <div className="table-scroll"><table><thead><tr><th>Target</th><th>Level</th><th>Reported battle total</th><th>Live availability</th><th>Last action</th><th>Last checked</th><th>Actions</th></tr></thead><tbody>{visible.map(target=>{const o=observations[target.id],state=targetAvailability(o,now);return <tr key={target.id}><td>{o?.name??target.name}<br/><small>#{target.id}</small></td><td>{o?.level??target.reportedLevel}<br/><small>{o?'API observed':'Community reported'}</small></td><td>{target.reportedTotal.toLocaleString()}<br/><small>Unverified / report date unknown</small></td><td>{state}{state==='Check again'&&o&&<small> · Last observed: {o.state}</small>}</td><td>{o?.lastAction?new Date(o.lastAction*1000).toLocaleString():'Unknown'}{o&&targetInactive(o,30,now)&&<small> · Inactive 30+ days</small>}</td><td>{o?new Date(o.fetchedAt).toLocaleString():'Not checked'}</td><td><a className="nu-btn" href={`https://www.torn.com/page.php?sid=attack&user2ID=${target.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Attack ${o?.name??target.name} in Torn (opens in a new tab)`}>Attack</a><button className="nu-btn" disabled={busy||!ready} onClick={()=>void refresh([target.id])}>Recheck</button><button className="nu-btn" disabled={!o} onClick={()=>setSelected(selected===target.id?null:target.id)}>Details</button><button className="nu-btn" onClick={()=>void navigator.clipboard.writeText(String(target.id)).then(()=>setMessage(`Copied target ID ${target.id}.`)).catch(()=>setError('Clipboard unavailable. The ID is shown in the target row.'))}>Copy ID</button></td></tr>;})}</tbody></table></div>
  {!visible.length&&<div role="status"><p>{sourceRows.length} targets exist in this list, but none match your current status and inactivity filters. Unchecked profiles cannot match a confirmed status or inactivity requirement.</p><button className="nu-btn" onClick={()=>{setAvailability('All');setInactive('any');}}>Show all {sourceRows.length} targets</button></div>}
  {detail&&<section className="card"><h4>{detail.name} · #{detail.id}</h4><p>Level {detail.level} · {detail.state} · Life {detail.life??'unknown'} / {detail.maximumLife??'unknown'}</p><p>Last action: {detail.lastAction?new Date(detail.lastAction*1000).toLocaleString():'not returned'}. Observed {new Date(detail.fetchedAt).toLocaleString()}.</p></section>}
  <details><summary>Source and freshness</summary><p>Starter catalogue: factual target entries reported in Baldr’s public Torn forum guide (thread 16034448). Snapshot retrieved {LEVELLING_SNAPSHOT}; per-target battle-report dates were not supplied. The snapshot date is not a spy date. Names and levels remain reported values until checked. Availability and inactivity may change; battle totals cannot be verified from public profiles. Attack opens the selected player’s official Torn attack page in a new tab. No external target-list website is contacted or linked.</p></details>
 </article>;
}
