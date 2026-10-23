import PlayerPicker from '../components/PlayerPicker';
import TornConnectionPanel from '../components/TornConnectionPanel';
import PlayerActions from '../components/PlayerActions';
import DateWindowPicker from '../components/DateWindowPicker';
import { useTornChoices } from '../hooks/useTornChoices';
import { useTornConnection } from '../hooks/useTornConnection';
import { functionError } from '../lib/function-error';
import { useEffect,useRef,useState } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { invokeTornData } from '../lib/torn-data-client';
import { observationKey } from '../lib/personal-data';
import { lookupPlayerProfile,playerId,PLAYER_PROFILE_ENDPOINT,profileHistory } from '../lib/player-intel';
import { object } from '../lib/connected-data';
import { defaultWindow,dateBounds } from '../lib/date-window';
import { COMPARISON_METRICS } from '../lib/player-comparison';
const routePlayer=()=>new URLSearchParams(location.hash.split('?')[1]??'').get('player')??'';
const display=(value:unknown)=>typeof value==='number'?value.toLocaleString():typeof value==='string'?value:'Unknown';
export default function PlayerIntel(){
 const choices=useTornChoices(),connection=useTornConnection(),client=useQueryClient();
 const [input,setInput]=useState(routePlayer),[player,setPlayer]=useState(routePlayer),[key,setKey]=useState('');
 const [chosenMode,setMode]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[warning,setWarning]=useState(''),[tab,setTab]=useState('Overview'),[window,setWindow]=useState(defaultWindow);
 const pending=useRef<AbortController|null>(null),keyInput=useRef<HTMLInputElement>(null);
 const mode=chosenMode??(connection.status.data?.hasStoredKey?'stored':'request');
 const ready=!!choices.owner&&(mode==='stored'?connection.status.data?.hasStoredKey!==false:/^[A-Za-z0-9]{16}$/.test(key));
 useEffect(()=>()=>{pending.current?.abort();},[]);
 useEffect(()=>{const change=()=>{setInput(routePlayer());setError('');};addEventListener('hashchange',change);return()=>removeEventListener('hashchange',change);},[]);
 const observation=choices.entries[observationKey(PLAYER_PROFILE_ENDPOINT,{id:player})]?.observation;
 const candidate=object(object(observation?.payload).profile),p=candidate.id===Number(player)?candidate:null;
 let bounds:ReturnType<typeof dateBounds>={},rangeError='';try{bounds=dateBounds(window);}catch(e){rangeError=(e as Error).message;}
 const history=useQuery({queryKey:['intel-history',choices.owner,player,window],enabled:!!choices.owner&&!!p&&['Activity','History'].includes(tab)&&!rangeError,staleTime:60000,queryFn:async()=>{
  let q=supabase.from('player_observations').select('status,level,last_action,observed_at').eq('user_id',choices.owner!).eq('torn_player_id',Number(player)).order('observed_at',{ascending:false}).limit(501);
  if(bounds.from)q=q.gte('observed_at',bounds.from);if(bounds.to)q=q.lt('observed_at',bounds.to);const r=await q;if(r.error)throw r.error;return r.data;
 }});
 const start=useQuery({queryKey:['intel-history-start',choices.owner,player],enabled:!!choices.owner&&!!p&&tab==='History',staleTime:60000,queryFn:async()=>{const r=await supabase.from('player_observations').select('observed_at').eq('user_id',choices.owner!).eq('torn_player_id',Number(player)).order('observed_at').limit(1);if(r.error)throw r.error;return r.data[0]?.observed_at??null;}});
 const statsId='v2-user-{id}-personalstats',statParameters={id:player,stat:COMPARISON_METRICS.map(m=>m.id).join(',')};
 const stats=choices.entries[observationKey(statsId,statParameters)]?.observation;
 async function lookup(value=input){
  if(pending.current)return;setError('');setWarning('');
  let id:number;try{id=playerId(value);}catch(failure){setError((failure as Error).message);return;}
  if(!ready){setError('Choose an available encrypted key or enter a request-only key.');keyInput.current?.focus();return;}
  const controller=new AbortController();pending.current=controller;setBusy(true);const secret=mode==='request'?key:undefined;setKey('');
  try{
   const result=await lookupPlayerProfile(String(id),secret,controller.signal,async(body,signal)=>{const response=await invokeTornData(client,{body,signal});if(response.error||response.data?.error)throw await functionError(response.data,response.error);return response.data;});
   setPlayer(String(id));setInput(String(id));setTab('Overview');
   if(!result.cached&&choices.owner){
    try{const recorded=await supabase.from('player_observations').insert(profileHistory(choices.owner,result));if(controller.signal.aborted)return;if(recorded.error)setWarning('Profile loaded, but this observation could not be added to your history.');else await client.invalidateQueries({queryKey:['intel-history']});}
    catch{if(!controller.signal.aborted)setWarning('Profile loaded, but this observation could not be added to your history.');}
   }
  }catch(failure){if(!controller.signal.aborted)setError(failure instanceof Error?failure.message:'Unable to load this player.');}
  finally{if(pending.current===controller){pending.current=null;setBusy(false);}}
 }
 async function loadStats(){
  if(!ready||!p||pending.current)return;const controller=new AbortController();pending.current=controller;setBusy(true);setError('');const secret=mode==='request'?key:undefined;setKey('');
  try{const r=await invokeTornData(client,{body:{endpoint_id:statsId,parameters:statParameters,...(secret?{apiKey:secret}:{})},signal:controller.signal});if(r.error||r.data?.error)throw await functionError(r.data,r.error);}
  catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Unable to load statistics.');}
  finally{if(pending.current===controller){pending.current=null;setBusy(false);}}
 }
 // Opening a tab uses its saved values first. A saved key permits one lazy collection.
 useEffect(()=>{if(tab==='Stats'&&p&&!stats&&mode==='stored'&&ready&&!busy)void loadStats();},[tab,player]);
 function cancel(){pending.current?.abort();pending.current=null;setBusy(false);setWarning('Lookup cancelled. Your last successful result is still available.');}
 const rows=(history.data??[]).slice(0,500),levels=rows.filter(r=>typeof r.level==='number'),delta=levels.length>=2?levels[0].level!-levels[levels.length-1].level!:null;
 return <section className="player-intel"><p>Look up a public profile, compare players or save a target. Private battle stats stay unknown without authorized evidence.</p>
  <form onSubmit={event=>{event.preventDefault();void lookup();}}>
   <PlayerPicker value={input} disabled={busy} onChange={value=>{setInput(value);setError('');}} required/>
   <TornConnectionPanel mode={mode} onMode={setMode} keyValue={key} onKey={setKey} disabled={busy} inputRef={keyInput}/>
   <button className="nu-btn" disabled={busy||!ready||!input}>{busy?'Loading…':'Look up player'}</button>{busy&&<button className="nu-btn" type="button" onClick={cancel}>Cancel lookup</button>}
   {!ready&&<p role="status">{!choices.owner?'Checking your account…':connection.status.isPending?'Checking your saved key…':mode==='stored'?'No encrypted key is available. Choose a request-only key or save one in Settings.':'Enter a 16-character request-only key above to look up a player.'}</p>}
  </form>
  <div aria-live="polite">{busy&&<p>Fetching from Torn. Your previous result stays visible.</p>}{warning&&<p role="status">{warning}</p>}</div>{error&&<p role="alert">{error}</p>}
  {p&&observation&&<><article className="card"><div className="intel-profile-heading"><div><h2>{p.name} <small>[{p.id}]</small></h2><p>Level {display(p.level)} · {p.status?.state??'Unknown status'} · {display(p.rank)}</p></div><button className="nu-btn" disabled={busy||!ready} onClick={()=>void lookup(player)}>Refresh profile</button></div>
   <p>Official Torn API · Collected {new Date(observation.fetched_at).toLocaleString()}. Saved snapshot; refresh to check changes.</p>{input!==player&&<p>Showing {p.name}. Look up your new selection to replace this result.</p>}
   <div className="intel-tabs" role="group" aria-label="Profile sections">{['Overview','Activity','Stats','History'].map(name=><button type="button" className={`nu-btn ${tab===name?'selected':''}`} key={name} aria-pressed={tab===name} onClick={()=>setTab(name)}>{name}</button>)}</div>
   {tab==='Overview'&&<dl className="data-metrics">{[['Title',p.title],['Faction ID',p.faction_id],['Age (days)',p.age],['Role',p.role],['Property',p.property?.name],['Life',p.life?`${p.life.current} / ${p.life.maximum}`:null],['Awards',p.awards],['Friends',p.friends],['Enemies',p.enemies],['Karma',p.karma],['Forum posts',p.forum_posts],['Status details',p.status?.description]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{display(value)}</dd></div>)}</dl>}
   {tab==='Activity'&&<><h3>Last observed activity</h3><p>{p.last_action?.status??'Unknown'} · {p.last_action?.timestamp?new Date(p.last_action.timestamp*1000).toLocaleString():'Time unknown'}</p><p>{p.status?.description??'Status unknown'}{p.status?.until?` until ${new Date(p.status.until*1000).toLocaleString()}`:''}</p><p>This is a snapshot, not continuous activity tracking. The history below contains only checks you collected.</p></>}
   {tab==='Stats'&&<><h3>Public statistics</h3><p>Seven comparable public counters. Personal battle stats are not exposed by a public profile.</p><button className="nu-btn" disabled={!ready||busy} onClick={()=>void loadStats()}>{busy?'Loading…':stats?'Refresh public stats':'Load public stats'}</button>{!ready&&<p>Choose a saved key or enter a request-only key above to load stats.</p>}{stats?<><p>Collected {new Date(stats.fetched_at).toLocaleString()}</p><dl className="data-metrics">{COMPARISON_METRICS.map(metric=>{const data=object(stats.payload).personalstats;const row=Array.isArray(data)?data.find(r=>r.name===metric.id):null;return <div key={metric.id}><dt>{metric.label}</dt><dd>{display(row?.value)}</dd></div>;})}</dl></>:<p>No collected public statistics yet.</p>}</>}
   {['Activity','History'].includes(tab)&&<><DateWindowPicker value={window} onChange={setWindow}/>{rangeError&&<p role="alert">{rangeError}</p>}{history.isFetching&&<p role="status">Loading saved observations…</p>}{history.isError&&<p role="alert">Could not load saved observations.</p>}{tab==='History'&&<>{start.isError&&<p role="alert">Could not check when collection began.</p>}<p>Collection began: {start.data?new Date(start.data).toLocaleString():start.isPending?'Loading…':'No observations yet'}. Checks are on demand; missing periods remain unknown.</p><p>Level change between collected observations: {delta===null?'At least two observations are needed':delta.toLocaleString()}. This does not establish exact change over the whole selected window.</p></>}
    {!rows.length&&!history.isFetching&&!rangeError&&<p>No collected observations in this window.</p>}{!!rows.length&&<div className="table-scroll"><table><thead><tr><th>Collected</th><th>Level</th><th>Status</th><th>Last action</th></tr></thead><tbody>{rows.map((r,i)=><tr key={`${r.observed_at}-${i}`}><td>{new Date(r.observed_at).toLocaleString()}</td><td>{display(r.level)}</td><td>{r.status??'Unknown'}</td><td>{r.last_action??'Unknown'}</td></tr>)}</tbody></table></div>}{(history.data?.length??0)>500&&<p>Showing the newest 500 observations. Choose a shorter window to see earlier checks.</p>}</>}
  </article>{choices.owner&&<PlayerActions key={player} player={p} owner={choices.owner}/>}</>}
 </section>;
}
