import type {PricePoint,StockForecast} from './stock-forecast.ts';
export type ProjectionKind='expected'|'upside'|'downside';
export type StockProjection={
 method:'historical-analogues-v1';sampleCount:number;
 paths:{kind:ProjectionKind;points:PricePoint[];samples:number}[];
 runs:{riseHours:number|null;fallHours:number|null;riseCount:number;fallCount:number};
};
const HOUR=3600;
const mean=(a:number[])=>a.reduce((s,n)=>s+n,0)/(a.length||1);
const median=(a:number[])=>{const s=[...a].sort((x,y)=>x-y);return s.length?(s[Math.floor((s.length-1)/2)]+s[Math.ceil((s.length-1)/2)])/2:null;};
/** Observed hourly runs only. Estimated prices, missing hours and the unfinished final run are excluded. */
export function stockRunIntervals(points:PricePoint[]):StockProjection['runs']{
 const rises:number[]=[],falls:number[]=[];let direction=0,duration=0;
 for(let i=1;i<points.length;i++){
  const left=points[i-1],right=points[i],hours=(right.timestamp-left.timestamp)/HOUR;
  if(left.estimated||right.estimated||hours<.8||hours>1.2){direction=0;duration=0;continue;}
  const sign=Math.sign(right.price-left.price);
  if(!sign)continue;
  if(direction&&sign!==direction){(direction>0?rises:falls).push(duration);duration=0;}
  direction=sign;duration+=hours;
 }
 return {riseHours:median(rises),fallHours:median(falls),riseCount:rises.length,fallCount:falls.length};
}
/** Shape estimates from completed historical trajectories, not an invented repeating wave.
 * The central shape is detrended to meet the separately tested endpoint forecast.
 * Conditional upside/downside paths are alternative scenarios, not confidence bounds. */
export function buildStockProjection(points:PricePoint[],forecast:StockForecast):StockProjection|undefined{
 const last=forecast.last;
 if(forecast.issue||!last||forecast.targetTime<=last.timestamp)return;
 const hours=Math.round((forecast.targetTime-last.timestamp)/HOUR);
 if(hours<1||points.length<24+hours+20)return;
 const feature=(i:number)=>{
  const recent=points.slice(i-24,i+1);
  if(i<24||recent.length!==25||recent.some(p=>p.estimated)||recent.some((p,j)=>j&&Math.abs(p.timestamp-recent[j-1].timestamp-HOUR)>60))return null;
  const price=points[i].price,returns=recent.slice(1).map((p,j)=>p.price/recent[j].price-1),avg=mean(returns);
  return [price/points[i-24].price-1,price/points[i-6].price-1,price/mean(recent.map(p=>p.price))-1,Math.sqrt(mean(returns.map(r=>(r-avg)**2)))];
 };
 // The latest partial hour can still provide features; use the preceding completed-hour shape as its context.
 const currentIndex=points.length-1;
 const context=feature(currentIndex)??feature(currentIndex-1);if(!context)return;
 const available:{index:number;features:number[]}[]=[];
 for(let i=24;i+hours<points.length;i++){
  const input=feature(i);if(!input)continue;
  const future=points.slice(i,i+hours+1);
  if(future.some(p=>p.estimated)||future.some((p,j)=>j&&Math.abs(p.timestamp-future[j-1].timestamp-HOUR)>60)||Math.abs(future.at(-1)!.timestamp-points[i].timestamp-hours*HOUR)>60)continue;
  available.push({index:i,features:input});
 }
 if(available.length<20)return;
 const scales=context.map((_,j)=>{const m=mean(available.map(r=>r.features[j]));return Math.sqrt(mean(available.map(r=>(r.features[j]-m)**2)))||1e-8;});
 available.sort((a,b)=>a.features.reduce((sum,v,j)=>sum+((v-context[j])/scales[j])**2,0)-b.features.reduce((sum,v,j)=>sum+((v-context[j])/scales[j])**2,0)||b.index-a.index);
 const matches=available.slice(0,40),offsets=[...new Set(Array.from({length:Math.min(hours,48)},(_,i)=>Math.max(1,Math.round((i+1)*hours/Math.min(hours,48)))))];
 const averageReturn=(group:typeof matches,step:number)=>mean(group.map(row=>points[row.index+step].price/points[row.index].price-1));
 const path=(group:typeof matches,kind:ProjectionKind)=>{
  const historicalEnd=averageReturn(group,hours);
  return {kind,samples:group.length,points:[{timestamp:last.timestamp,price:last.price},...offsets.map(step=>({timestamp:last.timestamp+step*HOUR,price:last.price*(1+averageReturn(group,step)+(kind==='expected'?(forecast.predictedReturn-historicalEnd)*step/hours:0))}))]};
 };
 const paths=[path(matches,'expected')];
 const up=matches.filter(r=>points[r.index+hours].price>points[r.index].price),down=matches.filter(r=>points[r.index+hours].price<points[r.index].price);
 if(up.length>=5)paths.push(path(up,'upside'));
 if(down.length>=5)paths.push(path(down,'downside'));
 if(paths.some(p=>p.points.some(v=>!Number.isFinite(v.price)||v.price<=0)))return;
 return {method:'historical-analogues-v1',sampleCount:matches.length,paths,runs:stockRunIntervals(points)};
}
/** Keep the saved forecast target, but connect remaining estimates to the latest observed quote. */
export function displayedStockProjection(f:StockForecast,last:PricePoint,now:number,maxQuoteAge=120):StockProjection['paths']{
 if(f.issue||!f.last||now-f.last.timestamp>600||f.last.timestamp>last.timestamp||now-last.timestamp>maxQuoteAge||f.targetTime<=now||f.targetTime<=last.timestamp||![f.predictedPrice,f.lower,f.upper].every(Number.isFinite)||f.predictedPrice<=0)return [];
 const source=f.projection?.paths??[{kind:'expected' as const,samples:0,points:[{timestamp:f.targetTime,price:f.predictedPrice}]}];
 return source.map(path=>({...path,points:[last,...path.points.filter(p=>p.timestamp>last.timestamp&&p.timestamp<=f.targetTime&&Number.isFinite(p.price)&&p.price>0).sort((a,b)=>a.timestamp-b.timestamp)]})).filter(path=>path.points.length>1);
}
