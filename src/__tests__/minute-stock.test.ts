import {describe,it,expect} from 'vitest';
import {STOCKS} from '../data/stocks';
import {forecastMinuteStock,scoreForwardPredictions} from '../lib/minute-forecast';
import {stockDecision,type PricePoint} from '../lib/stock-forecast';
import {watchlistMinutes,historyMinutes,boundedStockJson} from '../../supabase/functions/_shared/stock-minute-feed';
const start=1794000000;
const series=(n=600):PricePoint[]=>Array.from({length:n},(_,i)=>({timestamp:start+i*60,price:100*1.001**i}));
const feed=(ts=start):{timestamp:number;data:{stock:string;price:string;total_shares:number}[]}=>({timestamp:ts,data:STOCKS.map(s=>({stock:s.acronym,price:'100.25',total_shares:1000}))});
describe('verified minute price ingestion',()=>{
 it('requires a complete fresh feed and ignores the market index',()=>{
  const valid=feed();valid.data.push({stock:'TCSE',price:'9000',total_shares:1000});
  expect(watchlistMinutes(valid,start+15).points).toHaveLength(35);
  expect(()=>watchlistMinutes(feed(),start+181)).toThrow('Stale');
  expect(()=>watchlistMinutes({...feed(),data:feed().data.slice(1)},start)).toThrow('Incomplete');
  expect(()=>watchlistMinutes({...feed(),data:[...feed().data,feed().data[0]]},start)).toThrow('Duplicate');
  expect(()=>watchlistMinutes({...feed(),timestamp:start+1},start)).toThrow('invalid');
 });
 it('rejects invalid prices and future history instead of inventing minutes',()=>{
  expect(historyMinutes({data:[[start,'100.20',50],[start+120,'100.25',60]]},2,start+120)).toHaveLength(2);
  expect(()=>historyMinutes({data:[[start+60,'100',1]]},2,start)).toThrow('timestamp');
  expect(()=>historyMinutes({data:[[start,'NaN',1]]},2,start)).toThrow('price');
  expect(()=>historyMinutes({data:[[start,'100',-1]]},2,start)).toThrow('shares');
  expect(()=>historyMinutes({data:[[start,'100',1],[start,'100',1]]},2,start)).toThrow('Duplicate');
 });
 it('bounds network responses before JSON parsing',async()=>{
  const fake=(async()=>new Response('x'.repeat(512*1024+1))) as typeof fetch;
  await expect(boundedStockJson('https://tornsy.com/api/stocks',fake)).rejects.toThrow('too large');
 });
});
describe('chronological minute forecasts',()=>{
 it('uses distinct tuning and holdout windows and predicts the next minute',()=>{
  const p=series(),f=forecastMinuteStock(p,p.at(-1)!.timestamp+15);
  expect(f.issue).toBeUndefined();expect(f.tests).toBe(80);expect(f.tuningTests).toBe(40);
  expect(f.targetTime).toBe(p.at(-1)!.timestamp+60);expect(f.cadence).toBe(60);
  expect(f.predictedReturn).toBeCloseTo(.001,5);expect(f.mae).toBeLessThan(f.baselineMae);
  expect(f.validation.every(v=>v.timestamp<=f.last!.timestamp)).toBe(true);
 });
 it('excludes future prices and does not fill gaps',()=>{
  const p=series(),now=p.at(-1)!.timestamp+10;
  expect(forecastMinuteStock([...p,{timestamp:now+50,price:99999}],now)).toEqual(forecastMinuteStock(p,now));
  const gap=p.filter((_,i)=>i!==500),f=forecastMinuteStock(gap,now);
  expect(f.gapCount).toBe(1);expect(f.issue).toBeUndefined();
  expect(f.points).toHaveLength(599);expect(f.trainingSamples).toBeGreaterThan(360);
 });
 it('does not allow a future holdout price to alter an earlier prediction',()=>{
  const p=series(),now=p.at(-1)!.timestamp+10,original=forecastMinuteStock(p,now);
  const changed=p.map((r,i)=>i===p.length-1?{...r,price:r.price*1.01}:r);
  const other=forecastMinuteStock(changed,now);
  expect(original.model).toBe(other.model);
  expect(original.validation.slice(0,-1)).toEqual(other.validation.slice(0,-1));
  expect(original.validation.at(-1)!.predictedReturn).toBe(other.validation.at(-1)!.predictedReturn);
  expect(original.validation.at(-1)!.actualReturn).not.toBe(other.validation.at(-1)!.actualReturn);
 });
 it('rejects stale data and flat-series trading claims',()=>{
  const p=series();expect(forecastMinuteStock(p,p.at(-1)!.timestamp+121).issue).toContain('stale');
  const f=forecastMinuteStock(p.map(r=>({...r,price:100})),p.at(-1)!.timestamp+10);
  expect(f.model).toBe('No change');expect(f.supported).toBe(false);
  expect(stockDecision(f,p.at(-1)!.timestamp+10).signal).toBe('Wait');
 });
 it('scores only predictions with an actual price at the exact target minute',()=>{
  const scores=scoreForwardPredictions([{targetTime:start+60,predictedPrice:102,originPrice:100},{targetTime:start+120,predictedPrice:101,originPrice:100}],[{timestamp:start+60,price:101},{timestamp:start+180,price:102}]);
  expect(scores.tests).toBe(1);expect(scores.directionAccuracy).toBe(1);expect(scores.mae).toBeCloseTo(.01);
 });
});

describe('multi-minute horizons',()=>{
 it('purges overlapping future labels from both tuning and holdout training',()=>{
  const p=series(800),now=p.at(-1)!.timestamp+10;
  const original=forecastMinuteStock(p,now,15);
  const target=original.validation[20],origin=target.timestamp-15*60;
  const changed=p.map(r=>r.timestamp===origin+60?{...r,price:r.price*1.01}:r);
  const altered=forecastMinuteStock(changed,now,15);
  expect(altered.model).toBe(original.model);
  expect(altered.validation.find(v=>v.timestamp===target.timestamp)?.predictedReturn).toBe(target.predictedReturn);
  expect(original.targetTime).toBe(p.at(-1)!.timestamp+15*60);
  expect(original.cadence).toBe(900);
 });
});
