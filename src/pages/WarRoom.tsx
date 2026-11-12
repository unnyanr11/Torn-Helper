import {useEffect,useState} from 'react';
import {useWarTargets,warTargetAction} from '../components/WarTargetProvider';
import {attackUrl,type WarTargetContext,type WarTargetList} from '../lib/war-targets';
function TargetTable({list}:{list:WarTargetList|null}){
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 if(!list?.active||!list.target_ids.length)return <p>No targets selected for an active war. Choose your targets below.</p>;
 const fresh=Date.parse(list.verified_until)>now;
 const targets=list.targets.filter(t=>list.target_ids.includes(t.id));
 return <><p>Last checked: {new Date(list.updated_at).toLocaleTimeString()}{!fresh?' · Status verification expired. Refresh before attacking.':''}</p><table><thead><tr><th>Your target</th><th>Status / hospital timer</th><th>Attack</th></tr></thead><tbody>{targets.map(t=>{
  const seconds=t.hospital_until?Math.max(0,Math.ceil((t.hospital_until*1000-now)/1000)):0;
  return <tr key={t.id}><td>{t.name} [{t.id}] · Level {t.level}</td><td>{t.state==='Hospital'?(t.hospital_until?(seconds>0?`Hospital · ${Math.floor(seconds/60)}m ${seconds%60}s`:'Hospital deadline passed · awaiting status check'):'Hospital · release time unavailable'):t.state}</td><td>{fresh&&t.state==='Okay'?<a className="nu-btn" href={attackUrl(t.id)} target="_blank" rel="noopener noreferrer">Attack</a>:<span>Waiting for confirmed availability</span>}</td></tr>;
 })}</tbody></table>{targets.length<list.target_ids.length&&<p>Some selected targets left the enemy roster and are hidden.</p>}</>;
}
export default function WarRoom(){
 const {list,error:trackingError,refresh}=useWarTargets();
 const [context,setContext]=useState<WarTargetContext|null>(null),[selected,setSelected]=useState<number[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[editing,setEditing]=useState(false);
 async function load(warKey?:string,assigneeId?:number){
  setBusy(true);setError('');
  try{const result=await warTargetAction({action:'load',war_key:warKey,assignee_id:assigneeId});setContext(result);setSelected(result.list?.target_ids??[]);setEditing(true);refresh();}
  catch(e){setError(e instanceof Error?e.message:'Unable to load war.');}finally{setBusy(false);}
 }
 async function save(){
  if(!context)return;setBusy(true);setError('');
  try{const result=await warTargetAction({action:'save',war_key:context.war_key,assignee_id:context.assignee_id,target_ids:selected,expected_revision:context.assignment_revision});setContext(result);setEditing(false);refresh();}
  catch(e){setError(e instanceof Error?e.message:'Unable to save targets.');}finally{setBusy(false);}
 }
 const managing=!!context&&context.assignee_id!==context.actor_id;
 const shown=managing?context.list:list;
 const [desktop,setDesktop]=useState(typeof Notification!=='undefined'?Notification.permission:'unsupported');
 return <section><h2>War Room · My targets</h2>
  <p>Choose your opponents from an active ranked, raid, or territory war. Your faction leader can change assignments for members of the same faction.</p>
  {(error||trackingError)&&<p role="alert">{error||trackingError}</p>}
  <article className="card"><h3>{managing?`Targets for member ${context.assignee_id}`:'My selected targets'}</h3><TargetTable list={shown}/>
   <button className="nu-btn" disabled={busy} onClick={()=>void load()}>{busy?'Checking faction…':'Choose / edit my targets'}</button>
   {list&&<button className="nu-btn" disabled={busy} onClick={async()=>{setBusy(true);try{await warTargetAction({action:'alerts',enabled:!list.alerts_enabled});refresh();}catch(e){setError(String(e));}finally{setBusy(false);}}}>{list.alerts_enabled?'Pause hospital alerts':'Enable hospital alerts'}</button>}
   {desktop==='default'&&<button className="nu-btn" onClick={()=>void Notification.requestPermission().then(setDesktop)}>Enable desktop popups</button>}
   <p className="muted">Hospital popups are scheduled 20 seconds before the last confirmed release time while this app is open, including on other pages. Status is checked about once a minute only for an active saved list with alerts enabled. Countdowns make no API calls. Revives, new hospitalizations, API delays or a sleeping browser can change the timing.</p>
  </article>
  {editing&&context&&<article className="card"><h3>Choose targets</h3>
   {context.can_manage&&<label>Assign to <select className="nu-input" disabled={busy} value={context.assignee_id} onChange={e=>void load(context.war_key??undefined,Number(e.target.value))}>{context.members.map(m=><option key={m.id} value={m.id}>{m.name} [{m.id}]</option>)}</select></label>}
   {!context.wars.length?<p>No active faction war was found. Scheduled and ended wars aren’t attack lists.</p>:<>
    <label>Active war <select className="nu-input" disabled={busy} value={context.war_key??context.wars[0]?.key} onChange={e=>void load(e.target.value,context.assignee_id)}>{context.wars.map(w=><option key={w.key} value={w.key}>{w.kind} · {w.name}</option>)}</select></label>
    <div className="war-target-picker">{context.enemies.map(t=><label key={t.id}><input type="checkbox" checked={selected.includes(t.id)} disabled={busy} onChange={e=>setSelected(old=>e.target.checked?[...old,t.id]:old.filter(id=>id!==t.id))}/>{t.name} [{t.id}] · Level {t.level} · {t.state}</label>)}</div>
    <button className="nu-btn" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Save selected targets'}</button><button className="nu-btn" disabled={busy} onClick={()=>setEditing(false)}>Cancel</button>
   </>}
  </article>}
 </section>;
}
