import type {TradingDecision} from '../lib/long-term-stock';
import {stockTradeDecision,type StockHolding} from '../lib/stock-trade-decision';
import {type StockForecast} from '../lib/stock-forecast';
const money=(value:number)=>value.toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:2});
export default function StockAdvice({forecast,now,training=false,holding,decision:providedDecision}:{forecast?:StockForecast;now:number;training?:boolean;holding?:StockHolding;decision?:TradingDecision}){
 const decision=providedDecision??(forecast?stockTradeDecision(forecast,now,holding):null);
 const action=decision?.signal==='Hold'?'Hold':decision?.signal==='Buy candidate'?'Buy':decision?.signal==='Sell / rebuy watch'?'Sell':'Wait';
 return <div className={`stock-advice advice-${action.toLowerCase()}`}>
  <strong>{action}</strong>
  <p>{decision?.reason??(training?'Analysis is running. Wait for the result before deciding.':'A completed analysis is needed before suggesting a trade.')}</p>
  {action==='Buy'&&decision&&<p>Consider buying at or below <b>{money(decision.buyCeiling)}</b> per share. Above this level, the estimated margin no longer covers the model’s error range and selling fee.</p>}
  {action==='Sell'&&decision&&<p>Consider selling trading shares you already own. To increase your share count after the selling fee, a later rebuy would need to cost less than <b>{money(decision.rebuyCeiling)}</b> per share.</p>}
  {action==='Wait'&&<p>Keep your money or shares as they are while you check the next result.</p>}
  {action!=='Wait'&&<p>Preserve shares needed for benefit blocks. Prices and forecasts can change, and a profit is uncertain.</p>}
 </div>;
}
