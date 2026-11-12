import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useWarTargets} from './WarTargetProvider';
import {governanceAction,governanceKey,type WarGovernance} from '../lib/war-governance';
export default function WarCoordination(){
 const {owner,list,refresh}=useWarTargets(),client=useQueryClient(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [member,setMember]=useState(''),[target,setTarget]=useState(''),[mode,setMode]=useState('open'),[reason,setReason]=useState(''),[override,setOverride]=useState(false),[limit,setLimit]=useState<number|null>(null);
 const query=useQuery({queryKey:governanceKey(owner),enabled:!!owner&&!!list?.active,retry:false,refetchInterval:q=>q.state.error?false:30000,queryFn:()=>governanceAction({action:'poll'})});
 const data=query.isError?undefined:query.data;
 async function run(body:Record<string,unknown>,note:string){setBusy(true);setError('');try{const result=await governanceAction({...body,war_key:list?.war_key});if(Array.isArray(result.queue))client.setQueryData(governanceKey(owner),result);else await client.invalidateQueries({queryKey:governanceKey(owner)});refresh();setMessage(note);}catch(e){setError(e instanceof Error?e.message:'Coordination update failed.');}finally{setBusy(false);}}
 if(!owner||!list)return null;
 const myQueue=(data?.queue??[]).filter(q=>q.user_id===owner);
 return <article className="card"><h3>Fair claims and war coordination</h3><p>First come, first served for open targets. One active reservation per member. Queued members get a 60-second turn to confirm; stale turns expire. Leadership-assigned targets are marked separately.</p>
  <button className="nu-btn" disabled={busy} onClick={()=>void run({action:'verify'},'Current war and roles verified.')}>Refresh coordination &amp; roles</button>
  {query.isError&&<p>Verify your current war to load queues, requests and leadership controls.</p>}
  {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
  {data&&<><p>Default goal: one attack. Current maximum: {data.max_attacks} attacks per new claim.</p>
   <details open={myQueue.length>0}><summary>My waiting queues</summary>{myQueue.length===0?<p>You aren’t waiting for a target.</p>:<ul>{myQueue.map(q=>{
    const position=data.queue.filter(x=>x.target_id===q.target_id&&x.id<=q.id).length;
    return <li key={q.id}>Target [{q.target_id}] · Position {position}{q.offer_until?` · Confirm your turn before ${new Date(q.offer_until).toLocaleTimeString()}`:''}{q.resume_goal?' · Saved rest goal preserved':''}<button className="nu-btn" disabled={busy} onClick={()=>void run({action:'leave_queue',target_id:q.target_id},'Left the queue.')}>Leave queue</button></li>;
   })}</ul>}</details>
   <details open={data.requests.length>0}><summary>Mutual transfer and swap requests</summary><p>A request changes nothing until the current holder accepts. Expired or changed claims cannot be transferred.</p>{data.requests.length===0?<p>No pending requests.</p>:<ul>{data.requests.map(r=><li key={r.id}>Target [{r.target_id}]{r.swap_target_id?` ↔ target [${r.swap_target_id}]`:' · transfer request'} · Expires {new Date(r.expires_at).toLocaleTimeString()}{r.holder===owner?<><button className="nu-btn" disabled={busy} onClick={()=>void run({action:'respond',request_id:r.id,accept:true},'Mutual agreement accepted.')}>Accept</button><button className="nu-btn" disabled={busy} onClick={()=>void run({action:'respond',request_id:r.id,accept:false},'Request declined.')}>Decline</button></>:<button className="nu-btn" disabled={busy} onClick={()=>void run({action:'respond',request_id:r.id,accept:false},'Request cancelled.')}>Cancel request</button>}</li>)}</ul>}</details>
   {data.is_leader&&<details><summary>Appoint war handlers and set limits</summary><p>Appointments cover this war only. They grant target coordination, not access to private member stats. Only the current leader can appoint/remove handlers or change the limit.</p>
    <label>Faction member<select className="nu-input" value={member} onChange={e=>setMember(e.target.value)}><option value="">Choose a member</option>{data.members.filter(m=>m.id!==data.leader_id).map(m=><option key={m.id} value={m.id}>{m.name} [{m.id}]</option>)}</select></label>
    <button className="nu-btn" disabled={busy||!member} onClick={()=>void run({action:'handler',member_id:Number(member),enabled:true},'War handler appointed.')}>Appoint war handler</button>
    <ul>{data.handlers.map(h=><li key={h.torn_id}>{data.members.find(m=>m.id===h.torn_id)?.name??h.torn_id}<button className="nu-btn" disabled={busy} onClick={()=>void run({action:'handler',member_id:h.torn_id,enabled:false},'War handler removed.')}>Remove handler</button></li>)}</ul>
    <label>Maximum attacks per new claim<input className="nu-input" type="number" min={1} max={100} value={limit??data.max_attacks} onChange={e=>setLimit(Number(e.target.value))}/></label><button className="nu-btn" disabled={busy} onClick={()=>void run({action:'policy',max_attacks:limit??data.max_attacks},'Claim limit saved.')}>Save claim limit</button>
   </details>}
   {data.can_manage&&<details><summary>Leadership-assigned mode and reasoned overrides</summary><p>Assigning a target adds it to the member’s shortlist and makes it exclusive to them. They claim it when ready. Existing claims require an explicit override; all changes are recorded.</p>
    <label>Target<select className="nu-input" value={target} onChange={e=>setTarget(e.target.value)}><option value="">Choose an enemy target</option>{data.enemies.map(t=><option key={t.id} value={t.id}>{t.name} [{t.id}]</option>)}</select></label>
    <label>Coordination mode<select className="nu-input" value={mode} onChange={e=>setMode(e.target.value)}><option value="open">First come, first served</option><option value="assigned">Leadership assigned</option></select></label>
    {mode==='assigned'&&<label>Assign to<select className="nu-input" value={member} onChange={e=>setMember(e.target.value)}><option value="">Choose a linked member</option>{data.members.map(m=><option key={m.id} value={m.id}>{m.name} [{m.id}]</option>)}</select></label>}
    <label>Reason<input className="nu-input" minLength={3} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explain this tactical decision"/></label>
    <label><input type="checkbox" checked={override} onChange={e=>setOverride(e.target.checked)}/> Override an existing claim or replace a different war list</label>
    <button className="nu-btn" disabled={busy||!target||reason.trim().length<3||(mode==='assigned'&&!member)} onClick={()=>void run({action:'rule',target_id:Number(target),mode,member_id:member?Number(member):undefined,reason,override},'Leadership decision recorded; affected members notified.')}>Apply leadership decision</button>
   </details>}
   <details><summary>Recent war notifications</summary><ul>{data.notices.map((n,i)=><li key={`${n.created_at}:${i}`}>{new Date(n.created_at).toLocaleString()} · {n.body}</li>)}</ul><a href="#Notifications">Open notification inbox</a></details>
  </>}
 </article>;
}
