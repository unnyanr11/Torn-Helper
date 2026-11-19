import {useQuery} from '@tanstack/react-query';
import {supabase} from '../lib/supabase';
type StockWindowOpening={stock_id:number;open:number};
export function useStockWindowExtremes(minutes:number,at:string|null|undefined){
 return useQuery({queryKey:['stock-window-openings',minutes,at],enabled:!!at,staleTime:Infinity,retry:1,queryFn:async()=>{
  const result=await supabase.rpc('read_stock_window_openings',{p_window_minutes:minutes,p_as_of:at});
  if(result.error)throw result.error;
  if(!Array.isArray(result.data?.stocks)||result.data.window_minutes!==minutes||Date.parse(result.data.provider_at)!==Date.parse(at??''))throw new Error('Stock comparison range is unavailable');
  return result.data.stocks.map((row:StockWindowOpening)=>({...row,open:Number(row.open)})) as StockWindowOpening[];
 }});
}
