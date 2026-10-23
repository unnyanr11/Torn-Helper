import { pendingTornRequests as pending,type TornResult as Result } from './torn-request-state';
export { cancelTornRequests } from './torn-request-state';
import type { QueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { observationKey,type TornObservation } from './personal-data';
import { mergeObservation,observationsKey,isRecent } from './observation-cache';
import type { DataEntry } from './connected-data';
import { CAPABILITIES } from '../api/capabilities';
import { ESSENTIAL_PATHS } from './home-dashboard';
type Options={body:{endpoint_id:string;parameters:Record<string,string>;apiKey?:string};signal?:AbortSignal};
const cancelled=()=>new DOMException('Cancelled','AbortError');
const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');
/** Shared by all Torn tools. Secrets exist only in the active request closure. */
export async function invokeTornData(client:QueryClient,options:Options):Promise<Result>{
 if(options.signal?.aborted)throw cancelled();
 const {data:{session}}=await supabase.auth.getSession();const owner=session?.user.id;
 if(options.signal?.aborted)throw cancelled();
 if(!owner)throw new Error('Sign in to refresh Torn data.');
 const {endpoint_id,apiKey}=options.body;
 const parameters=Object.fromEntries(Object.entries(options.body.parameters).map(([key,value])=>[key,value.trim()]).filter(([,value])=>value!==''));
 const body={endpoint_id,parameters,...(apiKey===undefined?{}:{apiKey})},id=observationKey(endpoint_id,parameters),cacheKey=observationsKey(owner);
 const entry=client.getQueryData<Record<string,DataEntry>>(cacheKey)?.[id],cached=entry?.observation;
 const essential=ESSENTIAL_PATHS.includes(CAPABILITIES.find(c=>c.id===endpoint_id)?.path??'');
 if(isRecent(cached,60000)&&(!entry?.restored||essential))return {data:{...cached,cached:true},error:null};
 // Fingerprint separates simultaneous requests with different permissions, without retaining a raw key in a map or query key.
 const credential=apiKey===undefined?'stored':await digest(apiKey);
 if(options.signal?.aborted)throw cancelled();
 let jobs=pending.get(client);if(!jobs){jobs=new Map();pending.set(client,jobs);}
 const jobId=JSON.stringify([owner,id,credential]);let job=jobs.get(jobId);
 if(job?.controller.signal.aborted){jobs.delete(jobId);job=undefined;}
 if(!job){
  const controller=new AbortController();
  const run=async():Promise<Result>=>{
   if(controller.signal.aborted)throw cancelled();
   const current=await supabase.auth.getSession();if(current.data.session?.user.id!==owner)throw cancelled();
   let result:Result|undefined;
   const path=CAPABILITIES.find(c=>c.id===endpoint_id)?.path;
   // Essentials cannot paginate. Recheck their private database cache inside a cross-tab lock.
   if(path&&ESSENTIAL_PATHS.includes(path)&&!parameters.timestamp){
    const sorted=Object.fromEntries(Object.entries(parameters).sort(([a],[b])=>a.localeCompare(b)));
    const hash=await digest(JSON.stringify([endpoint_id,sorted]));
    const saved=await supabase.from('torn_data_cache').select('payload,fetched_at').eq('user_id',owner).eq('request_hash',hash).maybeSingle();
    if(!saved.error&&saved.data){const observation:TornObservation={...saved.data,endpoint_id,parameters,next_parameters:null,cached:true};if(isRecent(observation,60000))result={data:observation,error:null};}
   }
   if(controller.signal.aborted)throw cancelled();
   result??=await supabase.functions.invoke('torn-data',{body,signal:controller.signal});
   if(controller.signal.aborted)throw cancelled();
   const active=await supabase.auth.getSession();if(active.data.session?.user.id!==owner)throw cancelled();
   if(!result.error&&!result.data?.error&&result.data?.endpoint_id===endpoint_id){
    const observation=result.data as TornObservation;
    client.setQueryData<Record<string,DataEntry>>(cacheKey,old=>mergeObservation(old??{},observation));
    if(!observation.cached)client.setQueryData(['torn-verification',owner],{at:new Date().toISOString(),endpoint:CAPABILITIES.find(c=>c.id===endpoint_id)?.path??endpoint_id,mode:apiKey===undefined?'stored':'request'});
   }
   return result;
  };
  const lockId=`torn:${owner}:${id}`;
  const runLocked=async():Promise<Result>=>typeof navigator!=='undefined'&&navigator.locks?await navigator.locks.request(lockId,{signal:controller.signal},run):await run();
  const promise=runLocked().finally(()=>{if(jobs!.get(jobId)?.controller===controller)jobs!.delete(jobId);});
  job={controller,promise,users:0};jobs.set(jobId,job);
 }
 job.users++;const shared=job;
 return new Promise<Result>((resolve,reject)=>{
  let settled=false;
  const finish=(action:()=>void)=>{if(settled)return;settled=true;options.signal?.removeEventListener('abort',abort);shared.users--;if(shared.users===0)shared.controller.abort();action();};
  const abort=()=>finish(()=>reject(cancelled()));options.signal?.addEventListener('abort',abort,{once:true});
  if(options.signal?.aborted)abort();
  shared.promise.then(result=>finish(()=>resolve(result)),error=>finish(()=>reject(error)));
 });
}
