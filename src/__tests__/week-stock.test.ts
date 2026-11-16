import {describe,it,expect} from 'vitest';
import {expandingRidge} from '../lib/expanding-ridge';
import {fitPredict,type PricePoint} from '../lib/stock-forecast';
import {forecastMinuteStock,WEEK_SECONDS,WEEK_MINUTES} from '../lib/minute-forecast';
const start=1794000000;
describe('expanding weekly ridge',()=>{
 it('matches full-prefix ridge fits and never sees future labels',()=>{
  const samples=Array.from({length:1000},(_,i)=>{const x=[Math.sin(i/7),Math.cos(i/13),i/1000];return {x,y:.01*x[0]-.02*x[1]+.003*x[2]};});
  const fast=expandingRidge(samples),input=[.5,-.2,.8];
  for(const n of [30,200,360,600,1000])expect(fast(n,input)).toBeCloseTo(fitPredict(samples.slice(0,n),input),9);
  expect(fast(100,input)).toBeCloseTo(fitPredict(samples.slice(0,100),input),9);
 });
 it('uses all valid weekly history and discards observations older than seven days',()=>{
  const points:PricePoint[]=Array.from({length:WEEK_MINUTES+100},(_,i)=>({timestamp:start+i*60,price:100+Math.sin(i/30)+i*.0001}));
  const now=points.at(-1)!.timestamp+15,f=forecastMinuteStock(points,now);
  expect(f.issue).toBeUndefined();expect(f.observations).toBe(WEEK_MINUTES);expect(f.trainingSamples).toBeGreaterThan(9900);
  expect(f.points[0].timestamp).toBeGreaterThan(now-WEEK_SECONDS);
  expect(f.points.at(-1)).toEqual(points.at(-1));
 });
 it('retains usable samples before old gaps without creating fake prices',()=>{
  const p:PricePoint[]=Array.from({length:3000},(_,i)=>({timestamp:start+i*60,price:100+Math.sin(i/70)})).filter((_,i)=>i!==1000);
  const f=forecastMinuteStock(p,p.at(-1)!.timestamp+15,15);
  expect(f.issue).toBeUndefined();expect(f.gapCount).toBe(1);expect(f.points).toHaveLength(2999);
  expect(f.trainingSamples).toBeGreaterThan(2800);expect(f.points.some(p=>p.timestamp===start+1000*60)).toBe(false);
 });
});
