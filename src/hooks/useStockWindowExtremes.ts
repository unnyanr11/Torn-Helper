import {useQuery} from '@tanstack/react-query';
import {supabase} from '../lib/supabase';
import type {StockWindowExtreme} from '../lib/stock-window';
export function useStockWindowExtremes(minutes:number,at:string|null|undefined){
 return useQuery({queryKey:['stock-window-extremes',minutes,at],enabled:!!at,staleTime:Infinity,retry:1,queryFn:async()=>{
  const result=await supabase.rpc('read_stock_window_extremes',{p_window_minutes:minutes,p_as_of:at});
  if(result.error)throw result.error;
  if(!Array.isArray(result.data?.stocks)||result.data.window_minutes!==minutes||Date.parse(result.data.provider_at)!==Date.parse(at??''))throw new Error('Stock comparison range is unavailable');
  return result.data.stocks.map((row:StockWindowExtreme)=>({...row,low:Number(row.low),high:Number(row.high)})) as StockWindowExtreme[];
 }});
}
