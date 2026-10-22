import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { CachedChoiceRow } from '../lib/torn-choices';
export function useTornChoices() {
  return useQuery({queryKey:['torn-choices'],staleTime:60000,retry:false,queryFn:async():Promise<CachedChoiceRow[]>=>{
    const {data:{user}}=await supabase.auth.getUser();if(!user)return[];
    const r=await supabase.from('torn_data_cache').select('endpoint_id,payload,fetched_at').eq('user_id',user.id).gte('fetched_at',new Date(Date.now()-86400000).toISOString()).order('fetched_at',{ascending:false}).limit(100);
    if(r.error)throw r.error;return r.data??[];
  }});
}
