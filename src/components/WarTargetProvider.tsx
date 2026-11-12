import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '../lib/supabase';
import {functionError} from '../lib/function-error';
import {attackUrl,defaultWarPreferences,alertDeadline,hospitalAlertKey,scheduleHospitalAlerts,type WarTargetList,type WarTarget,type WarClaim,type WarAlertPreferences} from '../lib/war-targets';
import {governanceAction,governanceKey,type WarQueueEntry,type WarTargetRule} from '../lib/war-governance';
import {playWarSound,unlockWarSound} from '../lib/war-sound';
import './war-targets.css';
export const warTargetsKey=(owner:string)=>['war-targets',owner];
export async function warTargetAction(body:Record<string,unknown>){
 const result=await supabase.functions.invoke('war-targets',{body});
 if(result.error||result.data?.error)throw await functionError(result.data,result.error);
 return result.data;
}
const Context=createContext<{owner:string;list:WarTargetList|null;error:string;refresh:()=>void;claims:WarClaim[];queue:WarQueueEntry[];rules:WarTargetRule[];maxAttacks:number;preferences:WarAlertPreferences;savePreferences:(prefs:WarAlertPreferences)=>Promise<void>;testAlert:()=>void}>({owner:'',list:null,error:'',refresh:()=>{},claims:[],queue:[],rules:[],maxAttacks:3,preferences:defaultWarPreferences,savePreferences:async()=>{},testAlert:()=>{}});
export const useWarTargets=()=>useContext(Context);
export default function WarTargetProvider({owner,children}:{owner:string;children:ReactNode}){
 const client=useQueryClient(),[syncError,setSyncError]=useState(''),[popups,setPopups]=useState<{target:WarTarget;key:string}[]>([]),fired=useRef(new Set<string>()),[testing,setTesting]=useState(false),[turn,setTurn]=useState<WarQueueEntry|null>(null),announcedTurn=useRef('');
 const query=useQuery({queryKey:warTargetsKey(owner),enabled:!!owner,retry:false,refetchInterval:30000,queryFn:async()=>{
  const result=await supabase.from('war_target_lists').select('*').eq('user_id',owner).maybeSingle();
  if(result.error)throw result.error;return result.data as WarTargetList|null;
 }});
 const list=query.data??null;
 const preferencesQuery=useQuery({queryKey:['war-alert-preferences',owner],enabled:!!owner,retry:false,queryFn:async()=>{const r=await supabase.from('war_alert_preferences').select('*').eq('user_id',owner).maybeSingle();if(r.error)throw r.error;return (r.data??defaultWarPreferences) as WarAlertPreferences;}});
 const preferences=preferencesQuery.data??defaultWarPreferences;
 const claimKey=['war-claims',owner,list?.war_key,list?.faction_id];
 const claimsQuery=useQuery({queryKey:claimKey,enabled:!!owner&&!!list?.active,retry:false,refetchInterval:30000,queryFn:async()=>{
  const r=await supabase.from('war_target_claims').select('*').eq('faction_id',list!.faction_id).eq('war_key',list!.war_key).gt('expires_at',new Date().toISOString());if(r.error)throw r.error;return (r.data??[]) as WarClaim[];
 }});
 const claims=claimsQuery.data??[];
 const fairness=useQuery({queryKey:['war-fairness',owner,list?.war_key],enabled:!!owner&&!!list?.active,retry:false,refetchInterval:15000,queryFn:async()=>{
  const [q,r,p]=await Promise.all([supabase.from('war_wait_queue').select('*').eq('faction_id',list!.faction_id).eq('war_key',list!.war_key).gt('expires_at',new Date().toISOString()).order('id'),supabase.from('war_target_rules').select('*').eq('faction_id',list!.faction_id).eq('war_key',list!.war_key),supabase.from('war_claim_policies').select('max_attacks').eq('faction_id',list!.faction_id).eq('war_key',list!.war_key).maybeSingle()]);
  if(q.error)throw q.error;if(r.error)throw r.error;if(p.error)throw p.error;return {queue:(q.data??[]) as WarQueueEntry[],rules:(r.data??[]) as WarTargetRule[],maxAttacks:p.data?.max_attacks??3};
 }});

 useEffect(()=>{
  const mine=fairness.data?.queue.filter(q=>q.user_id===owner)??[];
  if(!owner||list?.resting||!mine.length){setTurn(null);return;}
  let disposed=false,busy=false;
  const poll=async()=>{
   if(busy)return;busy=true;
   try{
    const data=await governanceAction({action:'poll'});if(disposed)return;client.setQueryData(governanceKey(owner),data);
    const offered=data.queue.find(q=>q.user_id===owner&&q.offer_until&&Date.parse(q.offer_until)>Date.now())??null;setTurn(offered);
    if(offered&&announcedTurn.current!==`${offered.id}:${offered.offer_until}`){
     announcedTurn.current=`${offered.id}:${offered.offer_until}`;void playWarSound(preferences);
     if(preferences.desktop&&typeof Notification!=='undefined'&&Notification.permission==='granted')try{new Notification('Your target queue turn',{body:`Target ${offered.target_id} is free. Open War Room to confirm within 60 seconds.`,tag:`war-turn:${offered.id}`});}catch{/* In-app popup remains available. */}
    }
    await client.invalidateQueries({queryKey:['war-fairness',owner]});
   }catch{/* The explicit refresh in War Room can renew an expired verification. */}finally{busy=false;}
  };
  void poll();const timer=setInterval(()=>void poll(),15000);return()=>{disposed=true;clearInterval(timer);};
 },[owner,list?.resting,fairness.data?.queue.filter(q=>q.user_id===owner).map(q=>q.id).join(','),preferences,client]);
 useEffect(()=>{if(!owner||!list?.active)return;const channel=supabase.channel(`war-claims:${owner}`).on('postgres_changes',{event:'*',schema:'public',table:'war_target_claims',filter:`faction_id=eq.${list.faction_id}`},()=>void client.invalidateQueries({queryKey:['war-claims']})).subscribe();return()=>{void supabase.removeChannel(channel);};},[owner,list?.active,list?.faction_id,client]);
 useEffect(()=>{
  if(!owner||list?.resting||!claims.some(c=>c.user_id===owner&&Date.parse(c.expires_at)>Date.now()))return;
  let busy=false,disposed=false;
  const check=async()=>{if(busy)return;busy=true;try{await warTargetAction({action:'claim_sync'});if(!disposed)await client.invalidateQueries({queryKey:['war-claims']});}catch(e){if(!disposed)setSyncError(e instanceof Error?e.message:'Could not check claim attack counts.');}finally{busy=false;}};
  const timer=setInterval(()=>void check(),60000);return()=>{disposed=true;clearInterval(timer);};
 },[owner,list?.resting,claims.filter(c=>c.user_id===owner).map(c=>c.claim_id).join(','),client]);
 useEffect(()=>{
  if(!owner||!list?.active||list.resting||!list.alerts_enabled)return;
  const timers=list.targets.flatMap(target=>{
   const deadline=alertDeadline(target,Date.now(),preferences.lead_seconds);if(deadline===null||Number(target.checked_at)>=deadline-10000||Number(target.hospital_until)*1000<=Date.now())return [];
   return [setTimeout(()=>{void warTargetAction({action:'prealert',target_id:target.id}).then(()=>client.invalidateQueries({queryKey:warTargetsKey(owner)})).catch(()=>setSyncError('Could not verify a hospital alert; an outdated popup may be suppressed.'));},Math.max(0,deadline-10000-Date.now()))];
  });
  return()=>timers.forEach(clearTimeout);
 },[owner,list,preferences.lead_seconds,client]);

 useEffect(()=>{
  if(!owner)return;
  const channel=supabase.channel(`war-targets:${owner}`).on('postgres_changes',{event:'*',schema:'public',table:'war_target_lists',filter:`user_id=eq.${owner}`},()=>void client.invalidateQueries({queryKey:warTargetsKey(owner)})).subscribe();
  return()=>{void supabase.removeChannel(channel);};
 },[owner,client]);
 useEffect(()=>{
  if(!owner||!list?.active||list.resting||!list.alerts_enabled||!list.target_ids.length)return;
  let disposed=false,busy=false;
  const refresh=async()=>{
   if(busy)return;busy=true;
   try{await warTargetAction({action:'refresh'});if(!disposed){setSyncError('');await client.invalidateQueries({queryKey:warTargetsKey(owner)});await client.invalidateQueries({queryKey:['war-claims']});}}
   catch(error){if(!disposed)setSyncError(error instanceof Error?error.message:'War target refresh failed.');}
   finally{busy=false;}
  };
  if(Date.parse(list.updated_at)<Date.now()-30000)void refresh();
  const timer=setInterval(()=>void refresh(),60000);
  const wake=()=>{if(document.visibilityState==='visible')void refresh();};
  document.addEventListener('visibilitychange',wake);
  return()=>{disposed=true;clearInterval(timer);document.removeEventListener('visibilitychange',wake);};
 // Refresh cadence follows the active assignment, not every incoming status snapshot.
 },[owner,list?.active,list?.resting,list?.alerts_enabled,list?.war_key,list?.target_ids.join(','),client]);
 useEffect(()=>{
  if(!owner||!list)return;
  const seen=(key:string)=>{try{return fired.current.has(key)||localStorage.getItem(key)==='sent';}catch{return fired.current.has(key);}};
  return scheduleHospitalAlerts(list,owner,(target,key)=>{
   fired.current.add(key);try{localStorage.setItem(key,'sent');}catch{/* In-memory deduplication still applies. */}
   setPopups(old=>[...old,{target,key}]);void playWarSound(preferences);
   if(preferences.desktop&&typeof Notification!=='undefined'&&Notification.permission==='granted'){
    try{const notification=new Notification(`${target.name} leaves hospital soon`,{body:`Expected release in ${Math.max(1,Math.ceil((Number(target.hospital_until)*1000-Date.now())/1000))} seconds.`,tag:key});notification.onclick=()=>{window.focus();location.hash=encodeURIComponent('War Room');notification.close();};}catch{/* The in-app popup remains available. */}
   }
  },seen,Date.now,{leadSeconds:preferences.lead_seconds,requirePrecheck:true});
 },[owner,list,preferences]);
 const current=popups.filter(p=>list?.active&&!list.resting&&list.alerts_enabled&&Date.parse(list.verified_until)>Date.now()&&list.targets.some(t=>t.id===p.target.id&&hospitalAlertKey(owner,list.war_key,t)===p.key));
 return <Context.Provider value={{owner,list,claims,queue:fairness.data?.queue??[],rules:fairness.data?.rules??[],maxAttacks:fairness.data?.maxAttacks??3,preferences,savePreferences:async prefs=>{await unlockWarSound();await warTargetAction({action:'preferences',preferences:prefs});await client.invalidateQueries({queryKey:['war-alert-preferences',owner]});},testAlert:()=>{setTesting(true);void playWarSound(preferences);},error:syncError||(query.isError?'Unable to load saved war targets.':''),refresh:()=>{void client.invalidateQueries({queryKey:['war-fairness',owner]});void client.invalidateQueries({queryKey:['war-governance',owner]});void client.invalidateQueries({queryKey:warTargetsKey(owner)});void client.invalidateQueries({queryKey:['war-claims']});}}}>{children}
  {turn&&turn.offer_until&&Date.parse(turn.offer_until)>Date.now()&&!list?.resting&&<aside className="war-test-popup card" role="alert"><strong>Your queue turn · target [{turn.target_id}]</strong><p>Confirm your claim before {new Date(turn.offer_until).toLocaleTimeString()}.</p><a className="nu-btn" href="#War%20Room">Open War Room</a></aside>}
  {testing&&<aside className="war-test-popup card" role="alert"><strong>Test hospital alert</strong><p>Your popup is working. This is a preview, not a real target.</p><button className="nu-btn" onClick={()=>setTesting(false)}>Dismiss test</button></aside>}
  {current.length>0&&<aside className="war-hospital-popups" aria-label="War hospital alerts">{current.map(({target,key})=><section role="alert" className="card" key={key}><strong>{target.name} leaves hospital soon</strong><p>Expected release: {new Date(Number(target.hospital_until)*1000).toLocaleTimeString()}. Check their current status before attacking.</p><a className="nu-btn" href={claims.some(c=>c.target_id===target.id&&c.user_id===owner&&Date.parse(c.expires_at)>Date.now())?attackUrl(target.id):'#War%20Room'}>View claimed target</a><button className="nu-btn" onClick={()=>setPopups(old=>old.filter(p=>p.key!==key))}>Dismiss</button></section>)}</aside>}
 </Context.Provider>;
}
