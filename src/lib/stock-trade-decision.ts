import {SELL_FEE,stockDecision,type StockForecast,type StockDecision} from './stock-forecast';
export type StockHolding={stock_id:string;shares:string|number;avg_cost:string|number|null};
export const MIN_NET_SELL_PROFIT=.001;
export function stockTradeDecision(forecast:StockForecast,now:number,holding?:StockHolding,maxAge=120):StockDecision{
 const base=stockDecision(forecast,now,maxAge);
 if(base.signal==='Sell / rebuy watch'){
  if(!holding||!Number.isFinite(Number(holding.shares))||!(Number(holding.shares)>0))return {...base,signal:'Wait',reason:'No positive holding is recorded for this stock. Sell is available only for stocks you own.'};
  const cost=Number(holding.avg_cost);
  if(!Number.isFinite(cost)||cost<=0)return {...base,signal:'Wait',reason:'Add your average purchase cost to calculate profit before showing Sell.'};
  const profit=forecast.last!.price*(1-SELL_FEE)/cost-1;
  if(profit-MIN_NET_SELL_PROFIT<=1e-12)return {...base,signal:'Wait',reason:`Selling now returns ${(profit*100).toFixed(3)}% after the selling fee. Sell needs more than 0.100% net profit on your recorded purchase cost.`};
  return {...base,reason:`You own this stock. Selling now returns ${(profit*100).toFixed(3)}% net profit after the 0.1% selling fee, and the model supports a subsequent decline.`};
 }
 if(base.signal==='Buy candidate'){
  const dip=forecast.dip;
  if(!dip?.present)return {...base,signal:'Wait',reason:'Wait for a five-minute price drop below the recent 60-minute average before considering Buy.'};
  if(dip.tests<20||dip.reboundRate<.55)return {...base,signal:'Wait',reason:`The dip needs stronger rebound evidence: ${dip.tests} similar historical dips, ${(dip.reboundRate*100).toFixed(1)}% followed by a rise. At least 20 examples and 55% are required.`};
  return {...base,reason:`Price has dropped ${(dip.dropReturn*-100).toFixed(3)}% over five minutes and is below its 60-minute average. ${(dip.reboundRate*100).toFixed(1)}% of ${dip.tests} similar past dips rose within this horizon; the forecast also clears fees and its error margin.`};
 }
 return base;
}
