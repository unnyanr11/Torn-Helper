import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useCurrentObservations } from './useSavedObservations';
export type Verification={at:string;endpoint:string;mode:string};
export function useTornConnection(){
 const cache=useCurrentObservations(),owner=cache.owner;
 const status=useQuery({queryKey:['torn-connection',owner],enabled:!!owner,staleTime:60000,retry:false,queryFn:async()=>{
  const [identity,key]=await Promise.all([
   supabase.from('linked_torn_accounts').select('torn_id,torn_name,key_access_level,revoked_at').eq('user_id',owner!).maybeSingle(),
   supabase.from('encrypted_credentials').select('provider').eq('user_id',owner!).eq('provider','torn').maybeSingle()
  ]);
  if(identity.error)throw identity.error;if(key.error)throw key.error;
  return {identity:identity.data,hasStoredKey:!!key.data};
 }});
 const verification=useQuery<Verification|null>({queryKey:['torn-verification',owner],initialData:null,queryFn:async()=>null,staleTime:Infinity,enabled:false});
 return {owner,status,verification:verification.data};
}
