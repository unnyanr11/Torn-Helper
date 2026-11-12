import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '../lib/supabase';
import {mergeObservation,observationsKey} from '../lib/observation-cache';
import type {DataEntry} from '../lib/connected-data';
import type {TimerBaseline} from '../../supabase/functions/_shared/timer-events';
export type TimerSyncStatus={checked_through:number;status:string;message:string|null;updated_at:string};
const TimerContext=createContext<{baselines:TimerBaseline[];status:TimerSyncStatus|null;error:boolean;syncedAt:number;connection:string}>({baselines:[],status:null,error:false,syncedAt:0,connection:'waiting'});
export const useAccountTimers=()=>useContext(TimerContext);
export default function TimerProvider({owner,children}:{owner:string;children:ReactNode}){
 const client=useQueryClient(),key=['account-timers',owner];
 const [connection,setConnection]=useState('connecting');
 const query=useQuery({queryKey:key,enabled:!!owner,staleTime:60000,retry:false,refetchOnWindowFocus:true,refetchInterval:()=>typeof document!=='undefined'&&document.visibilityState==='visible'?60000:false,queryFn:async()=>{
  const [baselines,status]=await Promise.all([
   supabase.from('torn_timer_baselines').select('endpoint_id,payload,observed_at,deadlines').eq('user_id',owner),
   supabase.from('torn_timer_sync_status').select('checked_through,status,message,updated_at').eq('user_id',owner).maybeSingle()
  ]);
  if(baselines.error)throw baselines.error;if(status.error)throw status.error;
  return {baselines:(baselines.data??[]) as TimerBaseline[],status:status.data as TimerSyncStatus|null};
 }});
 useEffect(()=>{
  if(!owner||!query.data)return;
  client.setQueryData<Record<string,DataEntry>>(observationsKey(owner),old=>{
   let entries=old??{};
   for(const row of query.data.baselines)entries=mergeObservation(entries,{endpoint_id:row.endpoint_id,parameters:{},payload:row.payload,fetched_at:row.observed_at,next_parameters:null,cached:true});
   return entries;
  });
 },[owner,query.data,client]);
 useEffect(()=>{
  if(!owner||typeof supabase.channel!=='function')return;
  const channel=supabase.channel(`timers:${owner}`).on('postgres_changes',{event:'*',schema:'public',table:'torn_timer_baselines',filter:`user_id=eq.${owner}`},()=>void client.invalidateQueries({queryKey:['account-timers',owner]})).on('postgres_changes',{event:'*',schema:'public',table:'torn_timer_sync_status',filter:`user_id=eq.${owner}`},()=>void client.invalidateQueries({queryKey:['account-timers',owner]})).subscribe(state=>setConnection(state==='SUBSCRIBED'?'connected':state==='CHANNEL_ERROR'||state==='TIMED_OUT'?'database fallback':'connecting'));
  return()=>{void supabase.removeChannel(channel);};
 },[owner,client]);
 return <TimerContext.Provider value={{baselines:query.data?.baselines??[],status:query.data?.status??null,error:!!owner&&query.isError,syncedAt:query.dataUpdatedAt,connection}}>{children}</TimerContext.Provider>;
}
