import {useEffect} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '../lib/supabase';
import {mergeStockBatch,type StockBatch,type StockBatchResponse} from '../lib/stock-batch';
const key=['stock-all-minute-history'];
export function useAllStockHistory(providerAt:string|null|undefined,backfilled:number|undefined){
 const client=useQueryClient();
 const history=useQuery({
  queryKey:key,enabled:!!providerAt,staleTime:Infinity,retry:1,
  queryFn:async()=>{
   const previous=client.getQueryData<StockBatch>(key);
   const full=!previous||previous.backfilled_stocks!==backfilled;
   const after=full?null:Math.floor(Date.parse(previous.provider_at??'')/1000);
   const result=await supabase.rpc('read_all_stock_minute_history',{p_after:after});
   if(result.error)throw result.error;
   if(!result.data?.stocks||!result.data?.provider_at)throw new Error('The collector has no stock batch yet.');
   return mergeStockBatch(previous,result.data as StockBatchResponse,full);
  },
 });
 useEffect(()=>{if(providerAt)void history.refetch();},[providerAt,backfilled]);
 return history;
}
