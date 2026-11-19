import {SELL_FEE,type PricePoint,type StockForecast,type StockDecision} from './stock-forecast.ts';
import {MIN_NET_SELL_PROFIT,type StockHolding} from './stock-trade-decision.ts';
export type TradingMode='short'|'long';
export const SHORT_HORIZONS=[1,3,6,12,18,24] as const;
export const LONG_HORIZONS=[168,336,504,672] as const;
export const FORECAST_HOURS=[...SHORT_HORIZONS,...LONG_HORIZONS];
export const horizonLabel=(hours:number)=>hours>=168?`${hours/24} days`:`${hours} ${hours===1?'hr':'hours'}`;
export type LongTermForecast=StockForecast&{model:string;historyDays:number;coverage:number;change24h:number|null;change7d:number|null;change30d:number|null;mean24h:number;mean7d:number;mean30d:number;modelVersion:string;horizonHours?:number;windowDays?:number;tuningTests?:number;holdoutFrom?:number;tuningThrough?:number};
export type TradingDecision=Omit<StockDecision,'signal'>&{signal:StockDecision['signal']|'Hold'};
const mean=(a:number[])=>a.reduce((s,n)=>s+n,0)/(a.length||1);
const HOUR=3600,DAY=86400;
/** Hourly closes, including the latest partial hour. Fills are available only after the right neighbour. */
export function cleanLongTermHistory(input:PricePoint[],windowDays=30):PricePoint[]{
 const buckets=new Map<number,PricePoint>();
 for(const p of input)if(!p.estimated&&Number.isFinite(p.timestamp)&&Number.isFinite(p.price)&&p.price>0){const h=Math.floor(p.timestamp/HOUR);if(!buckets.has(h)||buckets.get(h)!.timestamp<p.timestamp)buckets.set(h,p);}
 const actual=[...buckets.values()].sort((a,b)=>a.timestamp-b.timestamp);const cutoff=(actual.at(-1)?.timestamp??0)-windowDays*DAY;
 const points:PricePoint[]=[];
 for(const right of actual.filter(p=>p.timestamp>cutoff)){
  const left=points.at(-1);
  if(left)for(let h=Math.floor(left.timestamp/HOUR)+1;h<Math.floor(right.timestamp/HOUR);h++)points.push({timestamp:h*HOUR+3599,price:(left.price+right.price)/2,estimated:true,availableAt:right.timestamp});
  points.push(right);
 }
 return points;
}
/** Fixed candidate models are selected on earlier data, then tested on a separate later window with a full forecast-horizon embargo. */
export function forecastLongTermStock(input:PricePoint[],horizonHours=24,windowDays=30):LongTermForecast{
 if(!FORECAST_HOURS.includes(horizonHours as typeof FORECAST_HOURS[number]))throw new Error('Unsupported forecast horizon');
 const duration=horizonHours*HOUR,warmup=windowDays===7?48:72,label=horizonLabel(horizonHours);
 const points=cleanLongTermHistory(input,windowDays),last=points.at(-1)??null;
 const historyDays=last&&points.length?(last.timestamp-points[0].timestamp)/DAY:0;
 const coverage=points.filter(p=>!p.estimated).length/(points.length||1);
 const prices=points.map(p=>p.price),index=prices.length-1;
 const average=(i:number,n:number)=>mean(prices.slice(Math.max(0,i-n+1),i+1));
 const change=(hours:number)=>index>=hours&&!points[index-hours].estimated?last!.price/prices[index-hours]-1:null;
 const result:LongTermForecast={points,last,cadence:HOUR,targetTime:(last?.timestamp??0)+duration,predictedPrice:last?.price??0,predictedReturn:0,lower:last?.price??0,upper:last?.price??0,tests:0,mae:0,baselineMae:0,directionAccuracy:0,supported:false,validation:[],model:'No change',historyDays,coverage,change24h:change(24),change7d:change(168),change30d:historyDays>=29.9?last!.price/prices[Math.max(0,index-720)]-1:null,mean24h:average(index,24),mean7d:average(index,168),mean30d:average(index,720),modelVersion:'hourly-horizons-v2',horizonHours,windowDays};
 if(!last||historyDays<(windowDays===7?3:7)||coverage<.8)return {...result,issue:`The ${label} forecast needs at least ${windowDays===7?3:7} days of history with 80% recorded hourly coverage.`};
 const cache=new Map<number,number[]|null>();
 const features=(i:number):number[]|null=>{
  if(cache.has(i))return cache.get(i)!;
  if(i<warmup||points[i].estimated||points.slice(Math.max(0,i-168),i+1).some(p=>(p.availableAt??p.timestamp)>points[i].timestamp))return null;
  const momentum=prices[i]/prices[i-24]-1,reversion=average(i,168)/prices[i]-1;
  const vector=[0,momentum*.5*(horizonHours/24),reversion*.5,(momentum*(horizonHours/24)+reversion)*.25];cache.set(i,vector);return vector;
 };
 const origins=points.map((_,i)=>i).filter(i=>i>=warmup&&i+horizonHours<points.length&&!points[i+horizonHours].estimated&&Math.abs(points[i+horizonHours].timestamp-points[i].timestamp-duration)<=60&&features(i));
 const split=Math.floor(origins.length*.5),holdoutStart=origins[split];
 const tuning=origins.filter(i=>i+horizonHours<(holdoutStart??0)),holdout=origins.slice(split);
 if(tuning.length<24||holdout.length<24)return {...result,issue:`Not enough completed ${label} outcomes for separate tuning and validation with a ${label} embargo. ${historyDays.toFixed(1)} days are available; longer forecasts need history spanning multiple forecast periods.`};
 const actual=(i:number)=>prices[i+horizonHours]/prices[i]-1;
 const scores=[0,1,2,3].map(model=>({model,error:mean(tuning.map(i=>Math.abs(features(i)![model]-actual(i))))}));
 scores.sort((a,b)=>a.error-b.error||a.model-b.model);const model=scores[0].model;
 const validation=holdout.map(i=>({timestamp:points[i+horizonHours].timestamp,predictedReturn:features(i)![model],actualReturn:actual(i)}));
 const errors=validation.map(v=>Math.abs(v.predictedReturn-v.actualReturn)).sort((a,b)=>a-b);
 const mae=mean(errors),baselineMae=mean(validation.map(v=>Math.abs(v.actualReturn))),accuracy=validation.filter(v=>Math.abs(v.actualReturn)>1e-10&&Math.sign(v.predictedReturn)===Math.sign(v.actualReturn)).length/validation.length;
 const vector=features(index);if(!vector)return {...result,issue:'Latest hourly features are incomplete. Waiting for recorded data.'};
 const predictedReturn=vector[model],margin=Math.max(errors[Math.ceil(errors.length*.9)-1]??0,1e-8);
 const pastDips=origins.filter(i=>prices[i]<average(i,24)&&prices[i]<prices[i-24]);
 const drop=change(24)??0;
 return {...result,tuningTests:tuning.length,holdoutFrom:points[holdoutStart].timestamp,tuningThrough:Math.max(...tuning.map(i=>points[i+horizonHours].timestamp)),model:['No change','Horizon-scaled momentum','Seven-day mean reversion','Momentum / reversion blend'][model],predictedReturn,predictedPrice:last.price*(1+predictedReturn),lower:Math.max(0,last.price*(1+predictedReturn-margin)),upper:last.price*(1+predictedReturn+margin),tests:validation.length,mae,baselineMae,directionAccuracy:accuracy,supported:model!==0&&validation.length>=24&&mae<baselineMae*.95&&accuracy>=.55&&Math.abs(predictedReturn)<.2,validation:validation.slice(-48),dip:{present:drop<0&&last.price<result.mean24h,dropReturn:drop,tests:pastDips.length,reboundRate:pastDips.filter(i=>actual(i)>0).length/(pastDips.length||1)}};
}
export function longTermStockDecision(f:LongTermForecast|undefined,now:number,holding?:StockHolding,quote?:PricePoint):TradingDecision{
 const label=horizonLabel(f?.horizonHours??24);
 const base:TradingDecision={signal:'Wait',reason:'Analysis for this horizon is not available yet.',stale:false,netReturn:0,buyCeiling:0,rebuyCeiling:0,blocker:'data'};
 if(!f?.last||f.issue)return {...base,reason:f?.issue??base.reason};
 const current=quote??f.last;
 if(![current.price,current.timestamp,f.predictedPrice,f.lower,f.upper].every(Number.isFinite)||current.price<=0||f.lower<0||f.upper<f.lower)return {...base,reason:'Invalid long-term analysis. Wait for a fresh backend result.'};
 if(now-f.last.timestamp>600||now-current.timestamp>(quote?120:600)||current.timestamp<f.last.timestamp||f.targetTime<=now||f.last.timestamp>now+60)return {...base,stale:true,blocker:'stale',reason:'Saved results or current prices are outdated. Wait for the next backend update.'};
 if(!f.supported)return {...base,blocker:f.model==='No change'?'baseline':'validation',reason:`Historical checks for this horizon do not establish a predictive edge: ${(f.directionAccuracy*100).toFixed(1)}% direction correct; at least 55% and 5% less error than no change are required.`};
 const owns=!!holding&&Number.isFinite(Number(holding.shares))&&Number(holding.shares)>0;
 const predictedReturn=f.predictedPrice/current.price-1,margin=Math.max(f.predictedPrice-f.lower,f.upper-f.predictedPrice)/current.price;
 const result={...base,netReturn:(1+predictedReturn)*(1-SELL_FEE)-1,buyCeiling:f.lower*(1-SELL_FEE),rebuyCeiling:current.price*(1-SELL_FEE)};
 if(predictedReturn<-(margin+SELL_FEE)){
  if(!owns)return {...result,blocker:'ownership' as const,reason:`A ${label} decline is forecast. You do not own this stock, so wait rather than sell.`};
  const cost=Number(holding!.avg_cost),profit=current.price*(1-SELL_FEE)/cost-1;
  if(!Number.isFinite(cost)||cost<=0)return {...result,blocker:'cost' as const,reason:'Add your average purchase cost before Sell can be evaluated.'};
  if(profit-MIN_NET_SELL_PROFIT<=1e-12)return {...result,signal:'Hold',blocker:'profit' as const,reason:`You own this stock, but selling returns only ${(profit*100).toFixed(3)}% after fees. Your Sell rule requires more than 0.100% net profit; review the downside forecast before deciding.`};
  return {...result,signal:'Sell / rebuy watch',reason:`The validated ${label} forecast points down beyond fees and historical error. Your recorded holding would return ${(profit*100).toFixed(3)}% net profit after the 0.1% fee.`};
 }
 if(predictedReturn>margin+SELL_FEE){
  if(owns)return {...result,signal:'Hold',blocker:undefined,reason:`You own this stock and the validated ${label} forecast supports retaining it. No Sell signal is present.`};
  if(!f.dip?.present||current.price>=f.mean24h)return {...result,blocker:'dip' as const,reason:'Wait for a 24-hour drop below the daily average before buying.'};
  if(f.dip.tests<20||f.dip.reboundRate<.55)return {...result,blocker:'rebound' as const,reason:`Only ${f.dip.tests} comparable past daily dips, with ${(f.dip.reboundRate*100).toFixed(1)}% rebounds. Buy requires 20 examples and 55% rebounds.`};
  return {...result,signal:'Buy candidate',blocker:undefined,reason:`A daily dip is below the 24-hour average; ${(f.dip.reboundRate*100).toFixed(1)}% of ${f.dip.tests} past daily dips recovered within ${label}. The validated forecast clears fees and historical error.`};
 }
 return {...result,signal:owns?'Hold':'Wait',blocker:'fees' as const,reason:owns?'You own this stock. The validated forecast does not support a trade after fees and error; retain it unless your own plan changes.':'The forecast move does not clear fees and historical error. Wait.'};
}
export function stockHorizonDecision(f:LongTermForecast|undefined,now:number,holding:StockHolding|undefined,quote:PricePoint|undefined,mode:TradingMode):TradingDecision{
 const decision=longTermStockDecision(f,now,holding,quote);
 return mode==='short'&&decision.signal==='Hold'?{...decision,signal:'Wait'}:decision;
}
