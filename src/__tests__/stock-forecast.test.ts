import {describe,it,expect,vi} from 'vitest';
import {forecastStock,stockHistory,stockDecision,HISTORY_ENDPOINT,SELL_FEE,type PricePoint} from '../lib/stock-forecast';
import {scanStockHistory} from '../lib/stock-scan';
import type {TornObservation} from '../lib/personal-data';
const start=1794000000;
const trend=(rate:number,count=120):PricePoint[]=>Array.from({length:count},(_,i)=>({timestamp:start+i*3600,price:100*(1+rate)**i}));
const payload=(points:PricePoint[],id=2)=>({stocks:{id,market:{price:9999},chart:{history:points}}});
describe('local stock regression and trading costs',()=>{
 it('accepts official per-stock chart history, sorts and deduplicates without training on quotes or future prices',()=>{
  const points=trend(.01,90),bad=[{timestamp:start-1,price:0},{timestamp:start-2,price:NaN},{timestamp:start+1000000,price:45}];
  const parsed=stockHistory(payload([...points].reverse().concat(points[0],...bad)),2,start+90*3600);
  expect(parsed).toEqual(points);
  expect(stockHistory(payload(points,3),2)).toEqual([]);
  expect(stockHistory({stocks:[{id:2,market:{price:12}}]},2)).toEqual([]);
  expect(parsed.every(p=>p.price!==9999)).toBe(true);
 });
 it('refuses short histories and inconsistent intervals rather than inventing missing data',()=>{
  expect(forecastStock(trend(.001,79)).issue).toContain('80');
  const points=trend(.001);points[45].timestamp+=500;
  expect(forecastStock(points).issue).toContain('uneven');
  expect(forecastStock([{timestamp:start,price:-2}]).issue).toContain('invalid');
 });
 it('learns a rising series and gates its buy candidate on held-out performance and sale costs',()=>{
  const forecast=forecastStock(trend(.004));
  expect(forecast.tests).toBeGreaterThanOrEqual(20);expect(forecast.supported).toBe(true);
  expect(forecast.mae).toBeLessThan(forecast.baselineMae*.95);
  expect(forecast.predictedReturn).toBeCloseTo(.004,6);
  const decision=stockDecision(forecast,forecast.last!.timestamp+30);
  expect(decision.signal).toBe('Buy candidate');
  expect(decision.netReturn).toBeCloseTo(1.004*(1-SELL_FEE)-1,6);
  expect(decision.buyCeiling).toBeCloseTo(forecast.lower*(1-SELL_FEE));
 });
 it('offers sell/rebuy watch only for declines clearing the sale fee and error margin',()=>{
  const forecast=forecastStock(trend(-.004));
  const decision=stockDecision(forecast,forecast.last!.timestamp+30);
  expect(decision.signal).toBe('Sell / rebuy watch');
  expect(decision.rebuyCeiling).toBeCloseTo(forecast.last!.price*.999);
  const tiny=forecastStock(trend(.0003));
  expect(stockDecision(tiny,tiny.last!.timestamp+30).signal).toBe('Wait');
 });
 it('does not mistake flat prices or a failed baseline comparison for predictive skill',()=>{
  const flat=forecastStock(trend(0));
  expect(flat.supported).toBe(false);expect(stockDecision(flat,flat.last!.timestamp+30).signal).toBe('Wait');
  const good=forecastStock(trend(.004));
  expect(stockDecision({...good,supported:false},good.last!.timestamp+30).signal).toBe('Wait');
 });
 it('expires a supported forecast at its target time and blocks future-dated observations',()=>{
  const f=forecastStock(trend(.004));
  expect(stockDecision(f,f.targetTime).stale).toBe(true);
  expect(stockDecision(f,f.targetTime).signal).toBe('Wait');
  expect(stockDecision(f,f.last!.timestamp-120).signal).toBe('Wait');
 });
 it('keeps walk-forward predictions unchanged when later prices change, proving test labels are not training inputs',()=>{
  const original=trend(.003,150).map((p,i)=>({...p,price:p.price*(1+Math.sin(i*.7)*.004)}));
  const altered=original.map((p,i)=>i>=140?{...p,price:p.price*1.12}:p);
  const a=forecastStock(original),b=forecastStock(altered);
  for(let i=0;i<a.validation.length;i++)if(a.validation[i].timestamp<=original[140].timestamp)expect(b.validation[i].predictedReturn).toBe(a.validation[i].predictedReturn);
  expect(b.validation.find(v=>v.timestamp===original[140].timestamp)?.actualReturn).not.toBe(a.validation.find(v=>v.timestamp===original[140].timestamp)?.actualReturn);
  const prefix=forecastStock(original.slice(0,140));
  const shared=prefix.validation.filter(v=>a.validation.some(w=>v.timestamp===w.timestamp));
  expect(shared.length).toBeGreaterThan(10);
  for(const v of shared)expect(v.predictedReturn).toBe(a.validation.find(w=>w.timestamp===v.timestamp)?.predictedReturn);
 });
 it('bounds training work while keeping the most recent real observations',()=>{
  const points=trend(.0001,800),parsed=stockHistory(payload(points),2,start+801*3600);
  expect(parsed).toHaveLength(600);expect(parsed[599]).toEqual(points[799]);
 });
});
const observation=(id:number,fetched_at=new Date(start*1000).toISOString()):TornObservation=>({endpoint_id:HISTORY_ENDPOINT,parameters:{stockId:String(id)},payload:payload(trend(.001),id),fetched_at,next_parameters:null});
const setup=()=>({ids:[1,2,3],signal:new AbortController().signal,saved:vi.fn((_id:number)=>undefined as TornObservation|undefined),fetch:vi.fn(async(id:number)=>observation(id)),pause:vi.fn(async()=>{}),progress:vi.fn(),now:()=>start*1000+60000});
describe('bounded explicit history scan',()=>{
 it('reuses recent owner-cache charts without fetching and fetches only missing histories with spacing',async()=>{
  const o=setup();o.saved.mockImplementation(id=>id===1?observation(id):undefined);
  expect(await scanStockHistory(o)).toEqual({done:3,total:3,stopped:false});
  expect(o.fetch.mock.calls.map(c=>c[0])).toEqual([2,3]);
  expect(o.pause).toHaveBeenCalledExactlyOnceWith(3400,o.signal);
 });
 it('does not retry failed requests or continue a scan after an error',async()=>{
  const o=setup();o.fetch.mockRejectedValue(new Error('Quota exceeded'));
  await expect(scanStockHistory(o)).rejects.toThrow('Quota exceeded');expect(o.fetch).toHaveBeenCalledTimes(1);
 });
 it('stops on cancellation and keeps work already completed',async()=>{
  const o=setup(),controller=new AbortController();o.signal=controller.signal;
  o.progress.mockImplementation(()=>controller.abort());
  expect(await scanStockHistory(o)).toEqual({done:1,total:3,stopped:true});expect(o.fetch).toHaveBeenCalledTimes(1);
 });
 it('honours explicit refresh and never substitutes another stock or endpoint cache',async()=>{
  const o=setup();o.ids=[2];o.saved.mockReturnValue(observation(2));
  await scanStockHistory({...o,force:true});expect(o.fetch).toHaveBeenCalledExactlyOnceWith(2,o.signal);
  o.fetch.mockClear();o.saved.mockReturnValue(observation(3));await scanStockHistory(o);expect(o.fetch).toHaveBeenCalledTimes(1);
 });
 it('deduplicates and bounds a scan to 35 useful stocks',async()=>{
  const o=setup();o.ids=[-1,1,1,...Array.from({length:80},(_,i)=>i+1)];
  const result=await scanStockHistory(o);expect(result.total).toBe(35);expect(o.fetch).toHaveBeenCalledTimes(35);
 });
});
