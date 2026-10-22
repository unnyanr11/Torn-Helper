import { useQuery,useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { observationsKey,mergeObservation } from '../lib/observation-cache';
import type { DataEntry } from '../lib/connected-data';
export function useSavedObservations(owner?:string){
 const client=useQueryClient();
 return useQuery({queryKey:observationsKey(owner??''),enabled:!!owner,staleTime:60000,retry:false,refetchOnWindowFocus:false,queryFn:async()=>{
  if(!owner)return {};
  const response=await supabase.from('torn_data_cache').select('endpoint_id,parameters,payload,fetched_at').eq('user_id',owner).gte('fetched_at',new Date(Date.now()-86400000).toISOString()).order('fetched_at',{ascending:false}).limit(100);
  if(response.error)throw response.error;
  let entries:Record<string,DataEntry>={};
  // Oldest first so equal identities retain their newest timestamp.
  for(const row of [...(response.data??[])].reverse())entries=mergeObservation(entries,{...row,parameters:row.parameters as Record<string,string>,next_parameters:null,cached:true},true);
  for(const entry of Object.values(client.getQueryData<Record<string,DataEntry>>(observationsKey(owner))??{}))if(entry.observation)entries=mergeObservation(entries,entry.observation,entry.restored);
  return entries;
 }});
}
/** App clears queries on identity changes; the owner is also part of every private cache key. */
export function useCurrentObservations(){
 const owner=useQuery({queryKey:['observation-owner'],staleTime:Infinity,retry:false,queryFn:async()=>{const result=await supabase.auth.getSession();if(result.error)throw result.error;return result.data.session?.user.id??null;}});
 const saved=useSavedObservations(owner.data??undefined);
 return {...saved,owner:owner.data,isError:owner.isError||saved.isError,error:owner.error??saved.error};
}
