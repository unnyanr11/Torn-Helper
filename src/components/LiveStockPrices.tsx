import {stockHorizonDecision,horizonLabel,type LongTermForecast,type TradingMode} from '../lib/long-term-stock';
import {useStockWindowExtremes} from '../hooks/useStockWindowExtremes';
import {stockWindowLabel} from '../lib/stock-window';
import {stockCardDecision} from '../lib/stock-card-decision';
import {type StockHolding} from '../lib/stock-trade-decision';
import {type StockForecast} from '../lib/stock-forecast';
import {useEffect,useRef} from 'react';
import {useQuery} from '@tanstack/react-query';
import {supabase} from '../lib/supabase';
import {stockLabel} from '../lib/stock-catalogue';
import AnimatedStockPrice from './AnimatedStockPrice';
export type StockLiveQuote={stock_id:number;price:number;source:string;observed_at:string};

export default function LiveStockPrices({at,connected,onSelect,onPrices,horizonHours,mode='short',longAnalyses={},analyses={},holdings=[],horizon=1,comparisonMinutes=1440,now=Date.now()/1000}:{at:string|null|undefined;connected:boolean;onSelect:(id:string)=>void;onPrices?:(quotes:StockLiveQuote[])=>void;horizonHours?:number;mode?:TradingMode;longAnalyses?:Record<string,LongTermForecast>;analyses?:Record<string,StockForecast>;holdings?:StockHolding[];horizon?:number;comparisonMinutes?:number;now?:number}){
 const extremes=useStockWindowExtremes(comparisonMinutes,at);
 const byId=new Map(extremes.data?.map(row=>[row.stock_id,row]));
 const latest=useRef(at);
 latest.current=at;
 const prices=useQuery({
  queryKey:['stock-live-prices'],enabled:!!at,staleTime:Infinity,retry:1,
  queryFn:async()=>{
   const result=await supabase.from('stock_minute_prices').select('stock_id,price,source,observed_at').eq('observed_at',latest.current!).order('stock_id');
   if(result.error)throw result.error;
   if(!result.data?.length)throw new Error('The latest price batch is unavailable.');
   return result.data.map(row=>({...row,price:Number(row.price)})).filter(row=>Number.isFinite(row.price)&&row.price>0) as StockLiveQuote[];
  },
 });
 useEffect(()=>{if(at)void prices.refetch();},[at]);
 useEffect(()=>{if(prices.data)onPrices?.(prices.data);},[prices.data,onPrices]);
 const cards=(prices.data??[]).map(quote=>({quote,decision:horizonHours!==undefined||mode==='long'?stockHorizonDecision(longAnalyses[quote.stock_id],now,holdings.find(h=>Number(h.stock_id)===quote.stock_id),{timestamp:Date.parse(quote.observed_at)/1000,price:quote.price},mode):stockCardDecision(analyses[quote.stock_id],quote.observed_at,now,holdings.find(h=>Number(h.stock_id)===quote.stock_id))}));
 const counts={Buy:0,Sell:0,Hold:0,Wait:0};for(const {decision} of cards)counts[decision.signal==='Hold'?'Hold':decision.signal==='Buy candidate'?'Buy':decision.signal==='Sell / rebuy watch'?'Sell':'Wait']++;
 return <section className="live-stock-board" aria-label="Live stock prices">
  <h4>Live prices</h4>
  <p role="status">{connected?'Price stream connected':'Reconnecting price stream · automatic backup checks active'}{prices.isError?' · Latest prices unavailable; previous quotes retained':''}</p>
  <p>Forecast: {horizonHours!==undefined?horizonLabel(horizonHours):`${horizon} minutes`}. Price movement compares the first and latest recorded quotes in the selected {stockWindowLabel(comparisonMinutes)} window.</p>
  {!!cards.length&&<p role="status">{counts.Buy} Buy · {counts.Sell} Sell · {mode==='long'?`${counts.Hold} Hold · `:''}{counts.Wait} Wait.</p>}
  {prices.isPending&&<p>Waiting for prices…</p>}
  {prices.data&&<><p className="muted">Observed {new Date(prices.data[0].observed_at).toLocaleString()} · {prices.data[0].source}. Select a stock for its chart and full signal explanation.</p>
   {extremes.isError&&<p role="alert">Comparison movement unavailable. <button className="nu-btn" onClick={()=>void extremes.refetch()}>Retry movement</button></p>}
   <div className="live-stock-grid">{cards.map(({quote,decision})=>{
    const action=decision.signal==='Hold'?'Hold':decision.signal==='Buy candidate'?'Buy':decision.signal==='Sell / rebuy watch'?'Sell':'Wait';
    return <button type="button" className="live-stock-quote" key={quote.stock_id} title={decision.reason} aria-label={`${stockLabel(quote.stock_id)}: ${action}. ${decision.reason}`} onClick={()=>onSelect(String(quote.stock_id))}>
     <span>{stockLabel(quote.stock_id)}</span><span className="stock-action">{action}</span>
     <AnimatedStockPrice value={quote.price} observedAt={quote.observed_at} comparisonPrice={Date.parse(quote.observed_at)===Date.parse(at??'')?byId.get(quote.stock_id)?.open??null:null}/>

    </button>;
   })}</div>
  </>}
 </section>;
}
