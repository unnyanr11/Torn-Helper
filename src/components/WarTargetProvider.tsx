import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '../lib/supabase';
import {functionError} from '../lib/function-error';
import {attackUrl,hospitalAlertKey,scheduleHospitalAlerts,type WarTargetList,type WarTarget} from '../lib/war-targets';
import './war-targets.css';
export const warTargetsKey=(owner:string)=>['war-targets',owner];
export async function warTargetAction(body:Record<string,unknown>){
 const result=await supabase.functions.invoke('war-targets',{body});
 if(result.error||result.data?.error)throw await functionError(result.data,result.error);
 return result.data;
}
const Context=createContext<{owner:string;list:WarTargetList|null;error:string;refresh:()=>void}>({owner:'',list:null,error:'',refresh:()=>{}});
export const useWarTargets=()=>useContext(Context);
export default function WarTargetProvider({owner,children}:{owner:string;children:ReactNode}){
 const client=useQueryClient(),[syncError,setSyncError]=useState(''),[popups,setPopups]=useState<{target:WarTarget;key:string}[]>([]),fired=useRef(new Set<string>());
 const query=useQuery({queryKey:warTargetsKey(owner),enabled:!!owner,retry:false,refetchInterval:30000,queryFn:async()=>{
  const result=await supabase.from('war_target_lists').select('*').eq('user_id',owner).maybeSingle();
  if(result.error)throw result.error;return result.data as WarTargetList|null;
 }});
 const list=query.data??null;
 useEffect(()=>{
  if(!owner)return;
  const channel=supabase.channel(`war-targets:${owner}`).on('postgres_changes',{event:'*',schema:'public',table:'war_target_lists',filter:`user_id=eq.${owner}`},()=>void client.invalidateQueries({queryKey:warTargetsKey(owner)})).subscribe();
  return()=>{void supabase.removeChannel(channel);};
 },[owner,client]);
 useEffect(()=>{
  if(!owner||!list?.active||!list.alerts_enabled||!list.target_ids.length)return;
  let disposed=false,busy=false;
  const refresh=async()=>{
   if(busy)return;busy=true;
   try{await warTargetAction({action:'refresh'});if(!disposed){setSyncError('');await client.invalidateQueries({queryKey:warTargetsKey(owner)});}}
   catch(error){if(!disposed)setSyncError(error instanceof Error?error.message:'War target refresh failed.');}
   finally{busy=false;}
  };
  if(Date.parse(list.updated_at)<Date.now()-30000)void refresh();
  const timer=setInterval(()=>void refresh(),60000);
  const wake=()=>{if(document.visibilityState==='visible')void refresh();};
  document.addEventListener('visibilitychange',wake);
  return()=>{disposed=true;clearInterval(timer);document.removeEventListener('visibilitychange',wake);};
 // Refresh cadence follows the active assignment, not every incoming status snapshot.
 },[owner,list?.active,list?.alerts_enabled,list?.war_key,list?.target_ids.join(','),client]);
 useEffect(()=>{
  if(!owner||!list)return;
  const seen=(key:string)=>{try{return fired.current.has(key)||localStorage.getItem(key)==='sent';}catch{return fired.current.has(key);}};
  return scheduleHospitalAlerts(list,owner,(target,key)=>{
   fired.current.add(key);try{localStorage.setItem(key,'sent');}catch{/* In-memory deduplication still applies. */}
   setPopups(old=>[...old,{target,key}]);
   if(typeof Notification!=='undefined'&&Notification.permission==='granted'){
    try{const notification=new Notification(`${target.name} leaves hospital soon`,{body:`Expected release in ${Math.max(1,Math.ceil((Number(target.hospital_until)*1000-Date.now())/1000))} seconds.`,tag:key});notification.onclick=()=>{window.focus();location.hash=encodeURIComponent('War Room');notification.close();};}catch{/* The in-app popup remains available. */}
   }
  },seen);
 },[owner,list]);
 const current=popups.filter(p=>list?.active&&list.alerts_enabled&&Date.parse(list.verified_until)>Date.now()&&list.targets.some(t=>t.id===p.target.id&&hospitalAlertKey(owner,list.war_key,t)===p.key));
 return <Context.Provider value={{owner,list,error:syncError||(query.isError?'Unable to load saved war targets.':''),refresh:()=>void client.invalidateQueries({queryKey:warTargetsKey(owner)})}}>{children}
  {current.length>0&&<aside className="war-hospital-popups" aria-label="War hospital alerts">{current.map(({target,key})=><section role="alert" className="card" key={key}><strong>{target.name} leaves hospital soon</strong><p>Expected release: {new Date(Number(target.hospital_until)*1000).toLocaleTimeString()}. Check their current status before attacking.</p><a className="nu-btn" href={attackUrl(target.id)} target="_blank" rel="noopener noreferrer">Open attack page</a><button className="nu-btn" onClick={()=>setPopups(old=>old.filter(p=>p.key!==key))}>Dismiss</button></section>)}</aside>}
 </Context.Provider>;
}
