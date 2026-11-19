import {expect,it} from 'vitest';
import {buildStockProjection,displayedStockProjection,stockRunIntervals} from '../lib/stock-projection';
import {forecastLongTermStock} from '../lib/long-term-stock';
const start=1794000000;
const prices=Array.from({length:720},(_,i)=>({timestamp:start+i*3600,price:100+Math.sin(i*Math.PI/6)*2+i*.001}));
it('derives a multi-step shape from recorded windows and meets the tested model endpoint',()=>{
 const f=forecastLongTermStock(prices),result=buildStockProjection(prices,f)!;
 expect(result.sampleCount).toBeGreaterThanOrEqual(20);
 const path=result.paths.find(p=>p.kind==='expected')!.points;
 expect(path[0]).toEqual(f.last);expect(path.at(-1)!.timestamp).toBe(f.targetTime);expect(path.at(-1)!.price).toBeCloseTo(f.predictedPrice,8);
 const directions=path.slice(1).map((p,i)=>Math.sign(p.price-path[i].price));expect(directions).toContain(1);expect(directions).toContain(-1);
 expect(result.runs.riseHours).toBeGreaterThan(0);expect(result.runs.fallHours).toBeGreaterThan(0);
});
it('shows both conditional scenarios only when enough matching completed up and down outcomes exist',()=>{
 const points=Array.from({length:40*72+25},(_,i)=>{
  const block=Math.floor(i/72),phase=i%72,sign=block%2?1:-1;
  return {timestamp:start+i*3600,price:phase<=24?100:phase<=48?100+sign*(phase-24)/24*10:100+sign*(72-phase)/24*10};
 });
 const f={...forecastLongTermStock(points,24,120),issue:undefined};
 const result=buildStockProjection(points,f)!;
 expect(result.paths.map(p=>p.kind)).toEqual(['expected','upside','downside']);
 expect(result.paths.find(p=>p.kind==='upside')!.points.at(-1)!.price).toBeGreaterThan(100);
 expect(result.paths.find(p=>p.kind==='downside')!.points.at(-1)!.price).toBeLessThan(100);
});
it('does not invent trajectories from insufficient history or estimated future examples',()=>{
 const f=forecastLongTermStock(prices);
 expect(buildStockProjection(prices.slice(-30),f)).toBeUndefined();
 expect(buildStockProjection(prices,{...f,issue:'Insufficient history'})).toBeUndefined();
 expect(buildStockProjection(prices.map(p=>({...p,estimated:true})),f)).toBeUndefined();
});
it('counts completed hourly runs and excludes incomplete intervals and the unfinished run',()=>{
 const points=[100,101,102,101,100,99,100,101].map((price,i)=>({timestamp:start+i*3600,price}));
 expect(stockRunIntervals(points)).toEqual({riseHours:2,fallHours:3,riseCount:1,fallCount:1});
 const partial=[...points,{timestamp:points.at(-1)!.timestamp+60,price:90}];
 expect(stockRunIntervals(partial)).toEqual(stockRunIntervals(points));
});
it('connects a recent saved forecast to the current price without moving its target date',()=>{
 const f=forecastLongTermStock(prices),now=f.last!.timestamp+120,quote={timestamp:now,price:101};f.projection=buildStockProjection(prices,f);
 const paths=displayedStockProjection(f,quote,now);
 expect(paths[0].points[0]).toEqual(quote);expect(paths[0].points.at(-1)!.timestamp).toBe(f.targetTime);
 expect(paths[0].points.slice(1).every(p=>p.timestamp>now)).toBe(true);
 expect(displayedStockProjection(f,quote,now+601)).toEqual([]);
 expect(displayedStockProjection({...f,issue:'No history'},quote,now)).toEqual([]);
});
