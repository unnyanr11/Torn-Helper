import {STOCK_WAIT_HELP} from '../lib/stock-explanations';
import type {TradingDecision} from '../lib/long-term-stock';
import {stockTradeDecision,type StockHolding} from '../lib/stock-trade-decision';
import {type StockForecast} from '../lib/stock-forecast';
const money=(value:number)=>value.toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:2});
export default function StockAdvice({forecast,now,training=false,holding,decision:providedDecision}:{forecast?:StockForecast;now:number;training?:boolean;holding?:StockHolding;decision?:TradingDecision}){
 const decision=providedDecision??(forecast?stockTradeDecision(forecast,now,holding):null);
 const action=decision?.signal==='Hold'?'Hold':decision?.signal==='Buy candidate'?'Buy':decision?.signal==='Sell / rebuy watch'?'Sell':'Wait';
 return <div className={`stock-advice advice-${action.toLowerCase()}`}>
  <strong>{action}</strong>
  <p>{action==='Buy'?'A possible buying opportunity that passed the current checks.':action==='Sell'?'A possible selling opportunity for shares you own.':action==='Hold'?'You own this stock. The current rules do not suggest selling.':'No trade suggestion for this forecast right now.'}</p>
  {(action==='Wait'||action==='Hold')&&decision?.blocker&&<p>{STOCK_WAIT_HELP[decision.blocker]}</p>}
  {action==='Hold'&&decision?.blocker==='profit'&&<p>The model also expects a price decline. Your profit rule blocks Sell; review the risk before deciding to keep the shares.</p>}
  {!decision&&<p>{training?'Analysis is running. Wait for the result before deciding.':'A completed analysis is needed before suggesting a trade.'}</p>}
  {decision&&<details><summary>Why this suggestion?</summary><p>{decision.reason}</p></details>}
  {action==='Buy'&&decision&&<p>Consider buying at or below <b>{money(decision.buyCeiling)}</b> per share. Above this level, the estimated margin no longer covers the model’s error range and selling fee.</p>}
  {action==='Sell'&&decision&&<p>Consider selling trading shares you already own. To increase your share count after the selling fee, a later rebuy would need to cost less than <b>{money(decision.rebuyCeiling)}</b> per share.</p>}
  {action==='Wait'&&<p>Wait does not mean the price will stay flat. It means the model has not found a trade that meets your rules.</p>}
  {action!=='Wait'&&<p>Preserve shares needed for benefit blocks. Prices and forecasts can change, and a profit is uncertain.</p>}
 </div>;
}
