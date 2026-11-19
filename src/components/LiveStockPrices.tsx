import {useEffect,useRef} from 'react';
import {useQuery} from '@tanstack/react-query';
import {supabase} from '../lib/supabase';
import {stockLabel} from '../lib/stock-catalogue';
import AnimatedStockPrice from './AnimatedStockPrice';
type Quote={stock_id:number;price:number;source:string;observed_at:string};

export default function LiveStockPrices({at,connected,onSelect}:{at:string|null|undefined;connected:boolean;onSelect:(id:string)=>void}){
 const latest=useRef(at);
 latest.current=at;
 const prices=useQuery({
  queryKey:['stock-live-prices'],enabled:!!at,staleTime:Infinity,retry:1,
  queryFn:async()=>{
   const result=await supabase.from('stock_minute_prices').select('stock_id,price,source,observed_at').eq('observed_at',latest.current!).order('stock_id');
   if(result.error)throw result.error;
   if(!result.data?.length)throw new Error('The latest price batch is unavailable.');
   return result.data.map(row=>({...row,price:Number(row.price)})).filter(row=>Number.isFinite(row.price)&&row.price>0) as Quote[];
  },
 });
 useEffect(()=>{if(at)void prices.refetch();},[at]);
 return <section className="live-stock-board" aria-label="Live stock prices">
  <h4>Live prices</h4>
  <p role="status">{connected?'Price stream connected':'Reconnecting price stream · automatic backup checks active'}{prices.isError?' · Latest prices unavailable; previous quotes retained':''}</p>
  {prices.isPending&&<p>Waiting for prices…</p>}
  {prices.data&&<><p className="muted">Observed {new Date(prices.data[0].observed_at).toLocaleString()} · {prices.data[0].source}. Changes compare consecutive received quotes.</p>
   <div className="live-stock-grid">{prices.data.map(quote=><button type="button" className="live-stock-quote" key={quote.stock_id} onClick={()=>onSelect(String(quote.stock_id))}>
    <span>{stockLabel(quote.stock_id)}</span><AnimatedStockPrice value={quote.price} observedAt={quote.observed_at}/>
   </button>)}</div>
  </>}
 </section>;
}
