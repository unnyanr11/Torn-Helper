import {useEffect} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '../lib/supabase';
import type {LongTermForecast} from '../lib/long-term-stock';
import type {PricePoint} from '../lib/stock-forecast';
export type LongTermStockRow={stock_id:number;provider_at:string;computed_at:string;forecast:LongTermForecast;processing_ms:number;batch_ms:number};
export function useLongTermStocks(enabled:boolean,at:string|null|undefined){
 const client=useQueryClient();
 const result=useQuery({queryKey:['stock-long-term-results'],enabled,staleTime:30000,refetchInterval:60000,retry:1,queryFn:async()=>{
  const result=await supabase.from('stock_long_term_results').select('stock_id,provider_at,computed_at,forecast,processing_ms,batch_ms').order('stock_id');
  if(result.error)throw result.error;return (result.data??[]) as LongTermStockRow[];
 }});
 useEffect(()=>{if(enabled&&at)void client.invalidateQueries({queryKey:['stock-long-term-results']});},[enabled,at,client]);
 return result;
}
export function useLongTermChart(stockId:number,enabled:boolean,computedAt:string|undefined){
 return useQuery({queryKey:['stock-long-term-chart',stockId,computedAt],enabled:enabled&&!!computedAt,staleTime:Infinity,retry:1,queryFn:async()=>{
  const result=await supabase.from('stock_long_term_results').select('points').eq('stock_id',stockId).single();
  if(result.error)throw result.error;if(!Array.isArray(result.data?.points))throw new Error('Long-term chart unavailable');return result.data.points as PricePoint[];
 }});
}
