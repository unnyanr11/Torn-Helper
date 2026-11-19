import {longTermStockDecision,type LongTermForecast,type TradingMode} from '../lib/long-term-stock';
import {useStockWindowExtremes} from '../hooks/useStockWindowExtremes';
import StockWindowRange from './StockWindowRange';
import {stockWindowLabel} from '../lib/stock-window';
import {stockCardDecision,WAIT_LABELS} from '../lib/stock-card-decision';
import {type StockHolding} from '../lib/stock-trade-decision';
import {type StockForecast} from '../lib/stock-forecast';
import {useEffect,useRef} from 'react';
import {useQuery} from '@tanstack/react-query';
import {supabase} from '../lib/supabase';
import {stockLabel} from '../lib/stock-catalogue';
import AnimatedStockPrice from './AnimatedStockPrice';
export type StockLiveQuote={stock_id:number;price:number;source:string;observed_at:string};

export default function LiveStockPrices({at,connected,onSelect,onPrices,mode='short',longAnalyses={},analyses={},holdings=[],horizon=1,comparisonMinutes=1440,now=Date.now()/1000}:{at:string|null|undefined;connected:boolean;onSelect:(id:string)=>void;onPrices?:(quotes:StockLiveQuote[])=>void;mode?:TradingMode;longAnalyses?:Record<string,LongTermForecast>;analyses?:Record<string,StockForecast>;holdings?:StockHolding[];horizon?:number;comparisonMinutes?:number;now?:number}){
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
 const cards=(prices.data??[]).map(quote=>({quote,decision:mode==='long'?longTermStockDecision(longAnalyses[quote.stock_id],now,holdings.find(h=>Number(h.stock_id)===quote.stock_id),{timestamp:Date.parse(quote.observed_at)/1000,price:quote.price}):stockCardDecision(analyses[quote.stock_id],quote.observed_at,now,holdings.find(h=>Number(h.stock_id)===quote.stock_id))}));
 const counts={Buy:0,Sell:0,Hold:0,Wait:0};for(const {decision} of cards)counts[decision.signal==='Hold'?'Hold':decision.signal==='Buy candidate'?'Buy':decision.signal==='Sell / rebuy watch'?'Sell':'Wait']++;
 const reasons=new Map<string,number>();for(const {decision} of cards)if(decision.signal==='Wait'){const label=decision.blocker?WAIT_LABELS[decision.blocker]:'No confirmed trade signal';reasons.set(label,(reasons.get(label)??0)+1);}
 return <section className="live-stock-board" aria-label="Live stock prices">
  <h4>Live prices</h4>
  <p role="status">{connected?'Price stream connected':'Reconnecting price stream · automatic backup checks active'}{prices.isError?' · Latest prices unavailable; previous quotes retained':''}</p>
  <p>{mode==='long'?'Long-term signals for the next 24 hours, using up to 30 days of history.':`Signals for the next ${horizon} minute${horizon>1?'s':''}.`} High/low comparisons use the selected {stockWindowLabel(comparisonMinutes)} chart range. Trade signals also require historical evidence, fees and your trade rules.</p>
  {!!cards.length&&<p role="status">{counts.Buy} Buy · {counts.Sell} Sell · {mode==='long'?`${counts.Hold} Hold · `:''}{counts.Wait} Wait{counts.Wait>0?` — ${[...reasons].map(([label,n])=>`${n}: ${label}`).join('; ')}`:''}.</p>}
  {prices.isPending&&<p>Waiting for prices…</p>}
  {prices.data&&<><p className="muted">Observed {new Date(prices.data[0].observed_at).toLocaleString()} · {prices.data[0].source}. Range values below use recorded quotes in the selected window.</p>
   <p className="muted">High/Low times show the latest recorded occurrence of each extreme in your local timezone. Past extremes describe the range, not the next turning point.</p>
   {extremes.isPending&&<p role="status">Loading high/low prices for all stocks…</p>}
   {extremes.isError&&<p role="alert">Comparison ranges could not be loaded. <button className="nu-btn" onClick={()=>void extremes.refetch()}>Retry ranges</button></p>}
   <p className="muted">Each Wait label has a reason below. Select a stock to see its full explanation in Suggested action above.</p>
   <div className="live-stock-grid">{cards.map(({quote,decision})=>{
    const action=decision.signal==='Hold'?'Hold':decision.signal==='Buy candidate'?'Buy':decision.signal==='Sell / rebuy watch'?'Sell':'Wait';
    return <button type="button" className="live-stock-quote" key={quote.stock_id} title={decision.reason} aria-label={`${stockLabel(quote.stock_id)}: ${action}. ${decision.reason}`} onClick={()=>onSelect(String(quote.stock_id))}>
     <span>{stockLabel(quote.stock_id)}</span><span className="stock-action">{action}</span>
     {action==='Wait'&&<span className="stock-wait-reason">{decision.blocker?WAIT_LABELS[decision.blocker]:'No confirmed trade signal'}</span>}
     {mode==='short'&&decision.blocker==='validation'&&analyses[quote.stock_id]&&<small className="stock-validation-text">Direction {(analyses[quote.stock_id].directionAccuracy*100).toFixed(1)}% / 55% required · Error improvement {(analyses[quote.stock_id].baselineMae>0?(1-analyses[quote.stock_id].mae/analyses[quote.stock_id].baselineMae)*100:0).toFixed(1)}% / 5% required</small>}
     {mode==='short'&&decision.blocker==='fees'&&analyses[quote.stock_id]&&<small className="stock-validation-text">Estimated move {(analyses[quote.stock_id].predictedReturn*100).toFixed(4)}% · Sell fee 0.1%</small>}
     {mode==='long'&&<span className="stock-wait-reason">{decision.reason}</span>}
     <AnimatedStockPrice showChange={false} value={quote.price} observedAt={quote.observed_at}/>
     {Date.parse(quote.observed_at)===Date.parse(at??'')&&byId.get(quote.stock_id)&&<StockWindowRange current={quote.price} range={byId.get(quote.stock_id)!} minutes={comparisonMinutes}/>}
    </button>;
   })}</div>
  </>}
 </section>;
}
