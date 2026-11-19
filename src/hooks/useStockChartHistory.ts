import {useEffect} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '../lib/supabase';
import type {PricePoint} from '../lib/stock-forecast';
export type ChartHistory={provider_at:string|null;points:PricePoint[]};
export function mergeChartHistory(previous:ChartHistory|undefined,incoming:{provider_at:string|null;points:[number,number][]}):ChartHistory{
 const merged=new Map(previous?.points.map(p=>[p.timestamp,p]));
 for(const [timestamp,raw] of incoming.points){const price=Number(raw);if(Number.isInteger(timestamp)&&Number.isFinite(price)&&price>0)merged.set(timestamp,{timestamp,price});}
 const latest=Math.max(0,...merged.keys()),cutoff=latest-7*86400;
 return {provider_at:incoming.provider_at,points:[...merged.values()].filter(p=>p.timestamp>cutoff).sort((a,b)=>a.timestamp-b.timestamp)};
}
export function useStockChartHistory(stockId:number,providerAt:string|null|undefined,enabled=true){
 const client=useQueryClient(),key=['stock-chart-history',stockId];
 const history=useQuery({queryKey:key,enabled:enabled&&!!providerAt,staleTime:15000,refetchInterval:30000,retry:1,
  queryFn:async()=>{
   const previous=client.getQueryData<ChartHistory>(key);
   const result=await supabase.rpc('read_stock_chart_history',{p_stock_id:stockId,p_after:previous?.points.at(-1)?.timestamp??null});
   if(result.error)throw result.error;
   if(!Array.isArray(result.data?.points))throw new Error('Stock chart history is unavailable');
   return mergeChartHistory(previous,result.data);
  },
 });
 useEffect(()=>{if(enabled&&providerAt)void client.invalidateQueries({queryKey:key});},[enabled,providerAt,stockId,client]);
 return history;
}
