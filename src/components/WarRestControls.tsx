import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '../lib/supabase';
import {useWarTargets,warTargetAction} from './WarTargetProvider';
import type {RestedWarClaim} from '../lib/war-targets';
export default function WarRestControls(){
 const {owner,list,refresh}=useWarTargets(),client=useQueryClient(),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const key=['war-rest',owner];
 const saved=useQuery({queryKey:key,enabled:!!owner,retry:false,refetchInterval:30000,queryFn:async()=>{
  const result=await supabase.from('war_rest_claims').select('user_id,faction_id,war_key,target_id,target_name,attacks_goal,attacks_done,rested_at').eq('user_id',owner);if(result.error)throw result.error;return (result.data??[]) as RestedWarClaim[];
 }});
 useEffect(()=>{
  if(!owner)return;
  const channel=supabase.channel(`war-rest:${owner}`).on('postgres_changes',{event:'*',schema:'public',table:'war_rest_claims',filter:`user_id=eq.${owner}`},()=>void client.invalidateQueries({queryKey:['war-rest',owner]})).subscribe();
  return()=>{void supabase.removeChannel(channel);};
 },[owner,client]);
 async function change(action:'rest'|'resume'){
  setBusy(true);setMessage('');setError('');
  try{
   const result=await warTargetAction({action});
   if(action==='rest')setMessage(`You’re resting. Released ${result.released??0} claims and saved their remaining attacks.`);
   else if(result.pending)setMessage(result.message);
   else{
    const resumed=(result.resumed??[]).map((r:any)=>`${r.name}: ${r.remaining} attacks left`).join('; ');
    const blocked=(result.blocked??[]).map((r:any)=>`${r.name}: ${r.reason}`).join('; ');
    const discarded=(result.discarded??[]).map((r:any)=>`${r.name}: ${r.reason}`).join('; ');
    setMessage([resumed?`Welcome back. Reserved ${resumed}.`:'You’re back. No previous targets were newly reserved.',blocked?`Still released: ${blocked}. Your queue position and saved goal are kept; claim when it is your turn.`:'',discarded?`Not resumed: ${discarded}.`:''].filter(Boolean).join(' '));
   }
   refresh();await client.invalidateQueries({queryKey:key});
  }catch(e){setError(e instanceof Error?e.message:'Could not change rest status. Your saved progress is retained.');}
  finally{setBusy(false);}
 }
 if(!owner||!list)return null;
 const rows=saved.data??[];
 return <article className="card"><h3>{list.resting?'Resting · targets released':'Taking a break?'}</h3><p>Release your claims now and keep your remaining attack goals for later. Hospital alerts and automatic war checks pause while you rest. Other faction members can claim the released targets.</p>
  <button className="nu-btn" disabled={busy||!!list.resting} onClick={()=>void change('rest')}>{busy?'Updating…':'I’m going to rest'}</button>
  <button className="nu-btn" disabled={busy||(!list.resting&&!rows.length)} onClick={()=>void change('resume')}>I’m back</button>
  <p>Returning checks attacks from before your break and restores a free target or joins the back of its queue, while keeping only targets still assigned to you in the current war. It never replaces another member’s claim.</p>
  {rows.length>0&&<ul aria-label="Saved attack goals">{rows.map(r=><li key={`${r.war_key}:${r.target_id}`}>{r.target_name} [{r.target_id}] · <strong>{Math.max(0,r.attacks_goal-r.attacks_done)} attacks remaining</strong> ({r.attacks_done} / {r.attacks_goal} confirmed)</li>)}</ul>}
  {message&&<p role="status">{message}</p>}{(error||saved.isError)&&<p role="alert">{error||'Could not load saved rest goals.'}</p>}
 </article>;
}
