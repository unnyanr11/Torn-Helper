import {useEffect,useState} from 'react';
import {useWarTargets,warTargetAction} from '../components/WarTargetProvider';
import {attackUrl,sortWarTargets,type WarTargetContext,type WarTargetList} from '../lib/war-targets';
import WarReadiness from '../components/WarReadiness';
import WarAlertSettings from '../components/WarAlertSettings';
import WarReportPanel from '../components/WarReportPanel';
function TargetTable({list,readOnly=false}:{list:WarTargetList|null;readOnly?:boolean}){
 const [now,setNow]=useState(Date.now()),[goals,setGoals]=useState<Record<number,number>>({}),[pending,setPending]=useState<number|null>(null),[claimError,setClaimError]=useState('');
 const {claims=[],owner,refresh}=useWarTargets();
 async function claim(targetId:number,release=false){setPending(targetId);setClaimError('');try{await warTargetAction({action:release?'release':'claim',target_id:targetId,attacks_goal:goals[targetId]??1});refresh();}catch(e){setClaimError(e instanceof Error?e.message:'Could not change claim.');}finally{setPending(null);}}
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 if(!list?.active||!list.target_ids.length)return <p>No targets selected for an active war. Choose your targets below.</p>;
 const fresh=Date.parse(list.verified_until)>now;
 const targets=sortWarTargets(list.targets.filter(t=>list.target_ids.includes(t.id)),list.priorities,now);
 return <>{claimError&&<p role="alert">{claimError}</p>}<p>Claims release after the chosen number of confirmed completed attacks (wins or losses, interrupted attacks excluded). Ten minutes without a confirmed attack also releases a claim, with a one-hour maximum. Counts may lag until the next activity check.</p><button className="nu-btn" disabled={pending!==null} onClick={async()=>{setPending(0);try{await warTargetAction({action:'claim_sync'});refresh();}catch(e){setClaimError(String(e));}finally{setPending(null);}}}>Check my claim progress</button><p>Last checked: {new Date(list.updated_at).toLocaleTimeString()}{!fresh?' · Status verification expired. Refresh before attacking.':''}</p><table><thead><tr><th>Your target</th><th>Status / hospital timer</th><th>Claim / attack</th></tr></thead><tbody>{targets.map(t=>{
  const seconds=t.hospital_until?Math.max(0,Math.ceil((t.hospital_until*1000-now)/1000)):0;
  const held=claims.find(c=>c.target_id===t.id&&Date.parse(c.expires_at)>now),mine=!!held&&held.user_id===owner;
  return <tr key={t.id}><td>{t.name} [{t.id}] · Level {t.level}<br/><span>{t.state==='Okay'?'Available now':t.state==='Hospital'&&seconds>0?(seconds<=60?'Leaving hospital soon':'In hospital'):'Waiting'} · Priority {({1:'High',2:'Normal',3:'Low'} as Record<number,string>)[list.priorities?.[t.id]??2]}</span></td><td>{t.state==='Hospital'?(t.hospital_until?(seconds>0?`Hospital · ${Math.floor(seconds/60)}m ${seconds%60}s`:'Hospital deadline passed · awaiting status check'):'Hospital · release time unavailable'):t.state}</td><td>{held?<><span>{mine?'Your claim':`Claimed by ${held.claimant_name}`} · {held.attacks_done} / {held.attacks_goal} attacks · {Math.max(0,Math.ceil((Date.parse(held.expires_at)-now)/1000))}s idle time left</span>{mine&&<button className="nu-btn" disabled={pending!==null||readOnly} onClick={()=>void claim(t.id,true)}>Release claim</button>}</>:<><label>Release after attacks<input className="nu-input war-claim-goal" aria-label={`Attacks before releasing ${t.name}`} type="number" min={1} max={100} value={goals[t.id]??1} onChange={e=>setGoals(old=>({...old,[t.id]:Number(e.target.value)}))}/></label><button className="nu-btn" disabled={pending!==null||!fresh||readOnly} onClick={()=>void claim(t.id)}>Claim target</button></>}<br/>{fresh&&t.state==='Okay'&&mine&&!readOnly?<a className="nu-btn" href={attackUrl(t.id)} target="_blank" rel="noopener noreferrer">Attack</a>:<span>Claim required; waiting if unavailable</span>}</td></tr>;
 })}</tbody></table>{targets.length<list.target_ids.length&&<p>Some selected targets left the enemy roster and are hidden.</p>}</>;
}
export default function WarRoom(){
 const {list,error:trackingError,refresh}=useWarTargets();
 const [context,setContext]=useState<WarTargetContext|null>(null),[selected,setSelected]=useState<number[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[editing,setEditing]=useState(false),[priorities,setPriorities]=useState<Record<string,number>>({});
 async function load(warKey?:string,assigneeId?:number){
  setBusy(true);setError('');
  try{const result=await warTargetAction({action:'load',war_key:warKey,assignee_id:assigneeId});setContext(result);setSelected(result.list?.target_ids??[]);setPriorities(result.list?.priorities??{});setEditing(true);refresh();}
  catch(e){setError(e instanceof Error?e.message:'Unable to load war.');}finally{setBusy(false);}
 }
 async function save(){
  if(!context)return;setBusy(true);setError('');
  try{const result=await warTargetAction({action:'save',war_key:context.war_key,assignee_id:context.assignee_id,target_ids:selected,priorities:Object.fromEntries(Object.entries(priorities).filter(([id])=>selected.includes(Number(id)))),expected_revision:context.assignment_revision});setContext(result);setEditing(false);refresh();}
  catch(e){setError(e instanceof Error?e.message:'Unable to save targets.');}finally{setBusy(false);}
 }
 const managing=!!context&&context.assignee_id!==context.actor_id;
 const shown=managing?context.list:list;
 const [desktop,setDesktop]=useState(typeof Notification!=='undefined'?Notification.permission:'unsupported');
 return <section><h2>War Room · My targets</h2>
  <p>Choose your opponents from an active ranked, raid, or territory war. Your faction leader can change assignments for members of the same faction.</p>
  {(error||trackingError)&&<p role="alert">{error||trackingError}</p>}
  <WarReadiness list={list}/><WarAlertSettings/>
  <article className="card"><h3>{managing?`Targets for member ${context.assignee_id}`:'My selected targets'}</h3><TargetTable list={shown} readOnly={managing}/>
   <button className="nu-btn" disabled={busy} onClick={()=>void load()}>{busy?'Checking faction…':'Choose / edit my targets'}</button>
   {list&&<button className="nu-btn" disabled={busy} onClick={async()=>{setBusy(true);try{await warTargetAction({action:'alerts',enabled:!list.alerts_enabled});refresh();}catch(e){setError(String(e));}finally{setBusy(false);}}}>{list.alerts_enabled?'Pause hospital alerts':'Enable hospital alerts'}</button>}
   {desktop==='default'&&<button className="nu-btn" onClick={()=>void Notification.requestPermission().then(setDesktop)}>Enable desktop popups</button>}
   <p className="muted">Hospital popups default to 20 seconds before the recorded release time; adjust this in alert settings. A targeted check shortly before the alert suppresses outdated timers while this app is open, including on other pages. Status is checked about once a minute only for an active saved list with alerts enabled. Countdowns make no API calls. Revives, new hospitalizations, API delays or a sleeping browser can change the timing.</p>
  </article>
  <WarReportPanel/>
  {context?.can_manage&&<article className="card"><h3>Leader assignment board</h3><button className="nu-btn" disabled={busy} onClick={()=>void load(context.war_key??undefined,context.assignee_id)}>Refresh assignment board</button><table><thead><tr><th>Member</th><th>Assigned targets</th><th>Actions</th></tr></thead><tbody>{context.board?.map(member=><tr key={member.id}><td>{member.name} [{member.id}]</td><td>{member.assignment?.target_ids.map(id=>context.enemies.find(t=>t.id===id)?.name??id).join(', ')||'Unassigned'}</td><td><button className="nu-btn" disabled={busy||!member.linked} onClick={()=>void load(context.war_key??undefined,member.id)}>{member.linked?'Edit assignments':'Member must link account'}</button></td></tr>)}</tbody></table><details><summary>Unassigned opponents</summary><ul>{context.enemies.filter(t=>!context.board?.some(m=>m.assignment?.target_ids.includes(t.id))).map(t=><li key={t.id}>{t.name} [{t.id}]</li>)}</ul></details><details><summary>Recent assignment changes</summary><ul>{context.history?.map((event,i)=><li key={i}>{new Date(event.created_at).toLocaleString()} · {context.members.find(m=>m.id===event.actor_torn_id)?.name??event.actor_torn_id} changed targets for member [{event.member_id}]: {(event.details.after??[]).join(', ')||'None'}</li>)}</ul></details></article>}
  {editing&&context&&<article className="card"><h3>Choose targets</h3>
   {context.can_manage&&<label>Assign to <select className="nu-input" disabled={busy} value={context.assignee_id} onChange={e=>void load(context.war_key??undefined,Number(e.target.value))}>{context.members.map(m=><option key={m.id} value={m.id}>{m.name} [{m.id}]</option>)}</select></label>}
   {!context.wars.length?<p>No active faction war was found. Scheduled and ended wars aren’t attack lists.</p>:<>
    <label>Active war <select className="nu-input" disabled={busy} value={context.war_key??context.wars[0]?.key} onChange={e=>void load(e.target.value,context.assignee_id)}>{context.wars.map(w=><option key={w.key} value={w.key}>{w.kind} · {w.name}</option>)}</select></label>
    <div className="war-target-picker">{context.enemies.map(t=><label key={t.id}><input type="checkbox" checked={selected.includes(t.id)} disabled={busy} onChange={e=>setSelected(old=>e.target.checked?[...old,t.id]:old.filter(id=>id!==t.id))}/>{t.name} [{t.id}] · Level {t.level} · {t.state}{selected.includes(t.id)&&<select aria-label={`Priority for ${t.name}`} className="nu-input" value={priorities[t.id]??2} disabled={busy} onChange={e=>setPriorities(old=>({...old,[t.id]:Number(e.target.value)}))}><option value={1}>High priority</option><option value={2}>Normal priority</option><option value={3}>Low priority</option></select>}</label>)}</div>
    <button className="nu-btn" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Save selected targets'}</button><button className="nu-btn" disabled={busy} onClick={()=>setEditing(false)}>Cancel</button>
   </>}
  </article>}
 </section>;
}
