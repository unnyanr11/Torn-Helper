import { useMemo } from 'react';
import { useItemCatalogue } from './useItemCatalogue';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { CachedChoiceRow } from '../lib/torn-choices';
export function useTornChoices() {
  const permanent=useItemCatalogue();
  const recent=useQuery({queryKey:['torn-choices'],staleTime:60000,retry:false,queryFn:async():Promise<CachedChoiceRow[]>=>{
    const {data:{user}}=await supabase.auth.getUser();if(!user)return[];
    const r=await supabase.from('torn_data_cache').select('endpoint_id,payload,fetched_at').eq('user_id',user.id).gte('fetched_at',new Date(Date.now()-86400000).toISOString()).order('fetched_at',{ascending:false}).limit(100);
    if(r.error)throw r.error;return r.data??[];
  }});
  const data=useMemo(()=>permanent.data?.items.length?[{endpoint_id:'v2-torn-items',payload:{items:permanent.data.items},fetched_at:permanent.data.fetched_at??undefined},...(recent.data??[])]:recent.data,[permanent.data,recent.data]);
  return {...recent,data,isError:recent.isError&&(!permanent.data?.items.length)||permanent.isError&&(!recent.data?.length)};
}
