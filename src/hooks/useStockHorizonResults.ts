import {useEffect} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '../lib/supabase';
import type {LongTermForecast} from '../lib/long-term-stock';
export type StockHorizonRow={stock_id:number;horizon_hours:number;provider_at:string;computed_at:string;forecast:LongTermForecast;processing_ms:number;batch_ms:number};
export const stockHorizonOptions=()=>({queryKey:['stock-horizon-results'],staleTime:30000,refetchInterval:60000,retry:1,queryFn:async()=>{
  const result=await supabase.from('stock_horizon_results').select('stock_id,horizon_hours,provider_at,computed_at,forecast,processing_ms,batch_ms').order('stock_id');
  if(result.error)throw result.error;return (result.data??[]) as StockHorizonRow[];
 }});
export function useStockHorizonResults(at:string|null|undefined){
 const client=useQueryClient();
 const result=useQuery(stockHorizonOptions());
 useEffect(()=>{if(at)void client.invalidateQueries({queryKey:['stock-horizon-results']});},[at,client]);
 return result;
}
