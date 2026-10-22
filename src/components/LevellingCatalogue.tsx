import { useEffect,useMemo,useRef,useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { STARTER_TARGETS,LEVELLING_SNAPSHOT } from '../data/levelling-targets';
import { filterStarterTargets,targetAvailability,targetObservation,type TargetObservation } from '../lib/levelling';
import { useTornChoices } from '../hooks/useTornChoices';
import { createTravelClient } from '../lib/travel-client';
import { functionError } from '../lib/function-error';
import { supabase } from '../lib/supabase';
import KeyDisclosure from './KeyDisclosure';
export default function LevellingCatalogue(){
 const cache=useTornChoices(),client=useQueryClient();
 const [maximum,setMaximum]=useState(1000),[availability,setAvailability]=useState('All'),[sort,setSort]=useState('stats');
 const [mode,setMode]=useState('request'),[key,setKey]=useState(''),[memory,setMemory]=useState(false),[busy,setBusy]=useState(false),[done,setDone]=useState(0),[total,setTotal]=useState(0),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [observations,setObservations]=useState<Record<number,TargetObservation>>({}),[now,setNow]=useState(Date.now),[selected,setSelected]=useState<number|null>(null);
 const control=useRef<AbortController|null>(null),live=useRef(true);
 const fetchProfile=useMemo(()=>createTravelClient(async(endpoint_id,parameters,apiKey,signal)=>{
  const r=await supabase.functions.invoke('torn-data',{body:{endpoint_id,parameters,...(apiKey===undefined?{}:{apiKey})},signal});
  if(r.error||r.data?.error){const e=await functionError(r.data,r.error);throw Object.assign(e,{status:r.error?.context?.status??503});}return r.data;
 }),[]);
 useEffect(()=>{live.current=true;const timer=setInterval(()=>setNow(Date.now()),15000);return()=>{live.current=false;clearInterval(timer);control.current?.abort();};},[]);
 useEffect(()=>{
  const restored:Record<number,TargetObservation>={};
  for(const row of cache.data??[]){const id=(row.payload as any)?.profile?.id;if(!STARTER_TARGETS.some(t=>t.id===id)||!row.fetched_at||restored[id])continue;
   try{restored[id]=targetObservation(id,{endpoint_id:row.endpoint_id,payload:row.payload,fetched_at:row.fetched_at,parameters:{id:String(id)},next_parameters:null});}catch{}
  }
  setObservations(old=>({...restored,...old}));
 },[cache.data]);
 const ready=mode==='stored'||/^[A-Za-z0-9]{16}$/.test(key);
 const visible=filterStarterTargets(STARTER_TARGETS,observations,maximum,availability,sort,now);
 const sourceRows=STARTER_TARGETS.filter(t=>t.reportedTotal<=maximum);
 async function refresh(ids=filterStarterTargets(STARTER_TARGETS,observations,maximum,'All',sort,Date.now()).reverse().map(t=>t.id)){
  if(busy||!ready)return;control.current?.abort();const controller=new AbortController();control.current=controller;setBusy(true);setDone(0);setTotal(ids.length);setMessage('');setError('');const supplied=mode==='request'?key:undefined;if(!memory)setKey('');let count=0;
  try{
   for(const id of ids){
    if(controller.signal.aborted)break;
    try{const data=await fetchProfile('/user/{id}/profile',{id:String(id)},supplied,controller.signal);if(controller.signal.aborted)break;
     const parsed=targetObservation(id,data);setObservations(old=>({...old,[id]:parsed}));setNow(Date.now());
    }catch(e){if(controller.signal.aborted)break;const status=(e as any)?.status;if([401,409,429].includes(status)||status>=500)throw e;setMessage(`Some targets could not be checked: ${e instanceof Error?e.message:'Profile unavailable'}`);}
    setDone(++count);
   }
   if(!controller.signal.aborted)setMessage(`Checked ${count} target profiles. Statuses expire after one minute; recheck a target before using it.`);
   if(!controller.signal.aborted)void client.invalidateQueries({queryKey:['torn-choices']});
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Unable to refresh targets.');}
  finally{if(live.current&&control.current===controller&&!controller.signal.aborted)setBusy(false);}
 }
 function stop(){control.current?.abort();setBusy(false);setMessage('Refresh stopped. Checked profiles remain visible.');}
 const detail=selected?observations[selected]:undefined;
 return <article className="card built-in-targets"><h3>Ready-made levelling lists</h3><p>{STARTER_TARGETS.length} real community-listed targets are included. Select a list below; no list creation or manual IDs are required.</p>
  <div className="travel-fields"><label>Built-in list<select className="nu-input" value={maximum} disabled={busy} onChange={e=>setMaximum(Number(e.target.value))}><option value="100">Starter · reported total up to 100</option><option value="500">Progressing · reported total up to 500</option><option value="1000">All starter targets · reported total up to 1,000</option></select></label>
  <label>Status filter<select className="nu-input" value={availability} onChange={e=>setAvailability(e.target.value)}>{['All','Available','Not checked','Check again','Recently active','Activity unknown','Hospital','Jail','Traveling','Abroad','Federal'].map(s=><option key={s}>{s}</option>)}</select></label>
  <label>Sort by<select className="nu-input" value={sort} onChange={e=>setSort(e.target.value)}><option value="stats">Lowest reported battle total</option><option value="level">Highest level</option><option value="name">Name</option></select></label></div>
  <p>Reported battle totals are community claims, not current private stats from Torn. Live status starts as “Not checked”. No target is guaranteed to be an easy win.</p>
  <details><summary>Refresh live target status</summary><label>Key to use<select className="nu-input" disabled={busy} value={mode} onChange={e=>{setMode(e.target.value);setKey('');setMemory(false);}}><option value="request">Use a key for this refresh</option><option value="stored">Use my saved encrypted key</option></select></label>{mode==='request'&&<><label>Torn API key<input className="nu-input" type="password" autoComplete="off" maxLength={16} value={key} disabled={busy} onChange={e=>setKey(e.target.value.trim())}/></label><label><input type="checkbox" checked={memory} disabled={busy} onChange={e=>setMemory(e.target.checked)}/> Keep this key in page memory for rechecks; leaving clears it</label><details><summary>Key privacy</summary><KeyDisclosure persist={false} session={memory}/></details></>}
  <button className="nu-btn" disabled={busy||!ready} onClick={()=>void refresh()}>{busy?'Checking targets…':`Refresh ${sourceRows.length} targets`}</button>{busy&&<button className="nu-btn" onClick={stop}>Stop refresh</button>}
  <p>Requests are spaced to respect Torn quotas. A full list takes about two minutes. A fresh “Okay” status plus no observed action for 30 days qualifies for the Available filter; private battle stats remain unknown.</p>
  </details>
  {busy&&<progress aria-label="Levelling profiles checked" max={Math.max(1,total)} value={done}/>}{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
  <div className="table-scroll"><table><thead><tr><th>Target</th><th>Level</th><th>Reported battle total</th><th>Live availability</th><th>Last checked</th><th>Actions</th></tr></thead><tbody>{visible.map(target=>{const o=observations[target.id],state=targetAvailability(o,now);return <tr key={target.id}><td>{o?.name??target.name}<br/><small>#{target.id}</small></td><td>{o?.level??target.reportedLevel}<br/><small>{o?'API observed':'Community reported'}</small></td><td>{target.reportedTotal.toLocaleString()}<br/><small>Unverified / report date unknown</small></td><td>{state}</td><td>{o?new Date(o.fetchedAt).toLocaleString():'Not checked'}</td><td><a className="nu-btn" href={`https://www.torn.com/page.php?sid=attack&user2ID=${target.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Attack ${o?.name??target.name} in Torn (opens in a new tab)`}>Attack</a><button className="nu-btn" disabled={busy||!ready} onClick={()=>void refresh([target.id])}>Recheck</button><button className="nu-btn" disabled={!o} onClick={()=>setSelected(selected===target.id?null:target.id)}>Details</button><button className="nu-btn" onClick={()=>void navigator.clipboard.writeText(String(target.id)).then(()=>setMessage(`Copied target ID ${target.id}.`)).catch(()=>setError('Clipboard unavailable. The ID is shown in the target row.'))}>Copy ID</button></td></tr>;})}</tbody></table></div>
  {!visible.length&&<p>No targets match this filter. Refresh profiles or select All statuses.</p>}
  {detail&&<section className="card"><h4>{detail.name} · #{detail.id}</h4><p>Level {detail.level} · {detail.state} · Life {detail.life??'unknown'} / {detail.maximumLife??'unknown'}</p><p>Last action: {detail.lastAction?new Date(detail.lastAction*1000).toLocaleString():'not returned'}. Observed {new Date(detail.fetchedAt).toLocaleString()}.</p></section>}
  <details><summary>Source and freshness</summary><p>Starter catalogue: factual target entries reported in Baldr’s public Torn forum guide (thread 16034448). Snapshot retrieved {LEVELLING_SNAPSHOT}; per-target battle-report dates were not supplied. The snapshot date is not a spy date. Names and levels remain reported values until checked. Availability and inactivity may change; battle totals cannot be verified from public profiles. Attack opens the selected player’s official Torn attack page in a new tab. No external target-list website is contacted or linked.</p></details>
 </article>;
}
