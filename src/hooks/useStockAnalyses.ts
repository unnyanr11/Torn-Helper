import {useEffect} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '../lib/supabase';
import type {MinuteForecast,MinuteHorizon} from '../lib/minute-forecast';
export type StockAnalysis={stock_id:number;horizon:MinuteHorizon;provider_at:string;computed_at:string;model_version:string;forecast:MinuteForecast;history_from:string|null;history_to:string|null;processing_ms:number};
export const stockAnalysisOptions=()=>({
 queryKey:['stock-server-analyses'],staleTime:60000,retry:1,
 queryFn:async()=>{
  const result=await supabase.from('stock_analysis_results').select('stock_id,horizon,provider_at,computed_at,model_version,forecast,history_from,history_to,processing_ms').order('stock_id');
  if(result.error)throw result.error;
  return (result.data??[]) as StockAnalysis[];
 },
});
export function useStockAnalyses(){
 const client=useQueryClient();
 const result=useQuery({...stockAnalysisOptions(),refetchInterval:60000});
 useEffect(()=>{
  let active=true;
  let pending:ReturnType<typeof setTimeout>|undefined;
  const refresh=()=>{clearTimeout(pending);pending=setTimeout(()=>void client.invalidateQueries({queryKey:['stock-server-analyses']}),1000);};
  const channel=supabase.channel('stock-server-analysis')
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'stock_analysis_status',filter:'id=eq.1'},refresh)
   .subscribe(status=>{if(active&&status==='SUBSCRIBED')void client.invalidateQueries({queryKey:['stock-server-analyses']});});
  return()=>{active=false;clearTimeout(pending);void supabase.removeChannel(channel);};
 },[client]);
 return result;
}
