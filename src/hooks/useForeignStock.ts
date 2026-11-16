import {useQuery} from '@tanstack/react-query';
import {supabase} from '../lib/supabase';
import {functionError} from '../lib/function-error';
import type {ForeignStock} from '../../supabase/functions/_shared/foreign-stock';

export function useForeignStock(){
 return useQuery({
  queryKey:['foreign-stock'],staleTime:60000,refetchInterval:60000,retry:false,
  queryFn:async()=>{
   const result=await supabase.functions.invoke('foreign-stock',{body:{}});
   if(result.error||result.data?.error)throw await functionError(result.data,result.error);
   return result.data as {rows:ForeignStock[];source:string;fetched_at:string;warning?:string};
  },
 });
}
