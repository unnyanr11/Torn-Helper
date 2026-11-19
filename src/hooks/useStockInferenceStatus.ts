import {useQuery} from '@tanstack/react-query';
import {supabase} from '../lib/supabase';
export function useStockInferenceStatus(){
 return useQuery({queryKey:['stock-inference-status'],staleTime:15000,refetchInterval:30000,retry:1,queryFn:async()=>{
  const result=await supabase.from('stock_analysis_status').select('provider_at,computed_at,duration_ms,stock_count,forecast_count,within_budget').eq('id',1).single();
  if(result.error)throw result.error;
  return result.data as {provider_at:string;computed_at:string;duration_ms:number|null;stock_count:number;forecast_count:number;within_budget:boolean};
 }});
}
