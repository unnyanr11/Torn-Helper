import { describe,it,expect,vi } from 'vitest';
import { CAPABILITIES } from '../api/capabilities';
import { compileTornRequest } from '../../supabase/functions/_shared/torn-data';
import { destinationItems,flightEstimate,marketMinimum,shopItems,shopQuote,travelProfit,tripCost } from '../lib/travel-profit';
import { createTravelClient,scanItemMarket } from '../lib/travel-client';
import type { TornObservation } from '../lib/personal-data';
const item=(id:number,type:string,country:string,price:number|null)=>({id,name:`Item ${id}`,type,value:{shops:[{country,shop:'General Store',buy_price:price}]}});
const observation=(payload:unknown,next:Record<string,string>|null=null):TornObservation=>({endpoint_id:'v2-market-{id}-itemmarket',parameters:{id:'1'},payload,fetched_at:'2026-10-22T00:00:00Z',next_parameters:next});
describe('travel item choices and prices',()=>{
 it('filters destination first, then category, without inventing unavailable shop prices',()=>{
  const items=shopItems({items:[item(1,'Flower','Mexico',100),item(2,'Plushie','Mexico',200),item(3,'Flower','Japan',500),item(4,'Flower','Mexico',null)]});
  expect(destinationItems(items,'Mexico').map(i=>i.id)).toEqual([1,2]);
  expect(destinationItems(items,'Mexico','Flower').map(i=>i.id)).toEqual([1]);
  expect(shopQuote(items[3],'Mexico')).toBeNull();expect(shopItems({})).toEqual([]);
 });
 it('selects the lowest valid listing, preserving missing market data as unknown',()=>{
  expect(marketMinimum({itemmarket:{cache_timestamp:1792627200,listings:[{price:100,amount:1},{price:10,amount:0},{price:-1,amount:1},{price:40,amount:2},{price:null,amount:2}]}})).toEqual({price:40,count:2,cacheTime:1792627200});
  expect(marketMinimum({itemmarket:{listings:[]}}).price).toBeNull();
 });
 it('uses personal flight timestamps only for the matching destination and method',()=>{
  const payload={travel:{destination:'Mexico',method:'Airstrip',departed_at:100,arrival_at:1180}};
  expect(flightEstimate('Mexico','Airstrip',payload).minutes).toBe(18);
  expect(flightEstimate('Japan','Airstrip',payload).minutes).toBe(149);
  expect(flightEstimate('Mexico','Standard',payload,true).minutes).toBe(18);
  expect(tripCost('Mexico','Airstrip',2,null)).toBe(0);
  expect(tripCost('Mexico','Standard',2,null)).toBe(13000);
  expect(tripCost('Japan','Business',2,null)).toBeNull();
  expect(tripCost('Japan','Business',0,null)).toBe(0);
  expect(tripCost('Japan','Business',2,100000)).toBe(200000);
 });
 it('calculates fee-adjusted round-trip profit/hour, including losses and unknown inputs',()=>{
  const args={buy:100,sell:200,quantity:10,cost:50,roundTripMinutes:40,waitMinutes:20,feePercent:5};
  expect(travelProfit(args)).toEqual({gross:2000,fee:100,profit:850,perItem:90,perHour:850,totalMinutes:60});
  expect(travelProfit({...args,buy:300})!.profit).toBe(-1150);
  for(const missing of [{buy:null},{sell:null},{cost:null},{roundTripMinutes:null},{quantity:1.5},{roundTripMinutes:0},{feePercent:101},{cost:NaN}])expect(travelProfit({...args,...missing})).toBeNull();
 });
});
describe('travel fetch orchestration',()=>{
 it('validates every request and serializes requests with a shared quota interval',async()=>{
  let time=0;const pause=vi.fn(async(ms:number)=>{time+=ms;});
  const invoke=vi.fn(async(id:string,p:Record<string,string>)=>{expect(()=>compileTornRequest(id,p)).not.toThrow();return observation({});});
  const client=createTravelClient(invoke,pause,()=>time),signal=new AbortController().signal;
  await Promise.all([client('/torn/items',{cat:'All'},undefined,signal),client('/user/travel',{},undefined,signal),client('/market/{id}/itemmarket',{id:'1',limit:'100'},undefined,signal)]);
  expect(invoke).toHaveBeenCalledTimes(3);expect(pause.mock.calls.map(c=>c[0])).toEqual([3400,3400]);
 });
 it('does not start an aborted selection after waiting in the queue',async()=>{
  const controller=new AbortController();controller.abort();const invoke=vi.fn(async()=>observation({}));
  const client=createTravelClient(invoke);
  await expect(client('/user/travel',{},undefined,controller.signal)).rejects.toThrow('Cancelled');expect(invoke).not.toHaveBeenCalled();
 });
 it('scans all returned market pages without following URLs or switching item IDs',async()=>{
  let calls=0;const fetch=vi.fn(async(p:Record<string,string>)=>{expect(p.id).toBe('1');return ++calls===1?observation({itemmarket:{cache_timestamp:100,listings:[{price:500,amount:1}]}},{id:'999',offset:'100'}):observation({itemmarket:{cache_timestamp:100,listings:[{price:100,amount:1}]}});});
  const scan=await scanItemMarket(1,fetch,new AbortController().signal);
  expect(scan).toMatchObject({price:100,count:2,pages:2,complete:true,cacheTimes:[100]});
 });
 it('bounds scans and retains a continuation instead of claiming full market coverage',async()=>{
  let offset=0;const fetch=vi.fn(async()=>observation({itemmarket:{listings:[{price:50,amount:1}]}},{offset:String(++offset*100)}));
  const scan=await scanItemMarket(1,fetch,new AbortController().signal);
  expect(scan.pages).toBe(5);expect(scan.complete).toBe(false);expect(scan.next).not.toBeNull();
 });
 it('discards late market results after cancellation and tracks mixed cache snapshots',async()=>{
  const c=new AbortController();await expect(scanItemMarket(1,async()=>{c.abort();return observation({});},c.signal)).rejects.toThrow('Cancelled');
  let n=0;const scan=await scanItemMarket(1,async()=>observation({itemmarket:{cache_timestamp:++n,listings:[{price:10,amount:1}]}},n===1?{offset:'100'}:null),new AbortController().signal);
  expect(scan.cacheTimes).toEqual([1,2]);
 });
});
