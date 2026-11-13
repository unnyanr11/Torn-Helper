import { describe,it,expect,vi } from 'vitest';
import { CAPABILITIES } from '../api/capabilities';
import { compileTornRequest } from '../../supabase/functions/_shared/torn-data';
import { FOREIGN_SHOP_PRICES,withSavedShopPrices,destinationItems,flightEstimate,marketMinimum,shopItems,shopQuote,travelProfit,tripCost } from '../lib/travel-profit';
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


describe('saved Mexico purchase reference',()=>{
 it('restores all 34 screenshot items without a live request or stock assumptions',()=>{
  const items=withSavedShopPrices([]);
  expect(destinationItems(items,'Mexico')).toHaveLength(34);
  expect(destinationItems(items,'United Kingdom')).toEqual([]);
  expect(new Set(FOREIGN_SHOP_PRICES.filter(p=>p.country==='Mexico').map(p=>p.id)).size).toBe(34);
  expect(FOREIGN_SHOP_PRICES.filter(p=>p.country==='Mexico'&&p.shop==='General Store')).toHaveLength(10);
  expect(FOREIGN_SHOP_PRICES.filter(p=>p.country==='Mexico'&&p.shop==='Arms Dealer')).toHaveLength(19);
  expect(FOREIGN_SHOP_PRICES.filter(p=>p.country==='Mexico'&&p.shop==='Black Market')).toHaveLength(5);
  expect(shopQuote(items.find(i=>i.id===260),'Mexico')).toMatchObject({buy_price:300,source:'User screenshot'});
  expect(shopQuote(items.find(i=>i.id===399),'Mexico')?.buy_price).toBe(20000000);
  expect(shopQuote(items.find(i=>i.id===1499),'Mexico')?.buy_price).toBe(141079);
  expect(FOREIGN_SHOP_PRICES.every(p=>!('stock' in p))).toBe(true);
 });
 it('prefers fetched country prices even if higher and preserves other countries without mutation',()=>{
  const live={id:260,name:'Dahlia',type:'Flower',value:{shops:[{country:'Mexico',shop:'General Store',buy_price:350},{country:'Japan',shop:'General Store',buy_price:500}]}};
  const merged=withSavedShopPrices([live]);
  expect(shopQuote(merged.find(i=>i.id===260),'Mexico')).toMatchObject({buy_price:350});
  expect(shopQuote(merged.find(i=>i.id===260),'Mexico')?.source).toBeUndefined();
  expect(shopQuote(merged.find(i=>i.id===260),'Japan')?.buy_price).toBe(500);
  expect(live.value.shops).toHaveLength(2);
 });
 it('fills missing country prices without fabricating market sale prices',()=>{
  const live={id:260,name:'Dahlia',type:'Flower',value:{shops:[{country:'Mexico',shop:'General Store',buy_price:null}]}};
  const merged=withSavedShopPrices([live]);
  expect(shopQuote(merged.find(i=>i.id===260),'Mexico')?.buy_price).toBe(300);
  expect(live.value.shops).toHaveLength(1);
  expect(withSavedShopPrices(merged)).toEqual(merged);
  expect(marketMinimum({}).price).toBeNull();
 });
});


describe('saved Canada purchase reference',()=>{
 it('restores the 21 Canadian screenshot prices including out-of-stock items',()=>{
  const references=FOREIGN_SHOP_PRICES.filter(p=>p.country==='Canada');
  expect(references).toHaveLength(21);
  expect(references.filter(p=>p.shop==='General Store')).toHaveLength(8);
  expect(references.filter(p=>p.shop==='Arms Dealer')).toHaveLength(4);
  expect(references.filter(p=>p.shop==='Black Market')).toHaveLength(9);
  const items=withSavedShopPrices([]);
  expect(destinationItems(items,'Canada')).toHaveLength(21);
  expect(shopQuote(items.find(i=>i.id===261),'Canada')?.buy_price).toBe(20);
  expect(shopQuote(items.find(i=>i.id===1504),'Canada')?.buy_price).toBe(153463);
  expect(shopQuote(items.find(i=>i.id===206),'Canada')?.buy_price).toBe(778607);
  // Shared items retain independent country prices; rows must not overwrite by item ID.
  expect(shopQuote(items.find(i=>i.id===200),'Canada')?.buy_price).toBe(25831);
  expect(shopQuote(items.find(i=>i.id===200),'Mexico')?.buy_price).toBe(21731);
  expect(new Set(FOREIGN_SHOP_PRICES.map(p=>`${p.country}:${p.shop}:${p.id}`)).size).toBe(FOREIGN_SHOP_PRICES.length);
 });
});

describe('saved China purchase reference',()=>{
 it('restores all 22 screenshot prices with country-specific observations and no stock assumptions',()=>{
  const rows=FOREIGN_SHOP_PRICES.filter(p=>p.country==='China');
  expect(rows).toHaveLength(22);
  expect(rows.filter(p=>p.shop==='General Store')).toHaveLength(6);
  expect(rows.filter(p=>p.shop==='Arms Dealer')).toHaveLength(10);
  expect(rows.filter(p=>p.shop==='Black Market')).toHaveLength(6);
  expect(rows.every(p=>p.observed_on==='2026-11-12'&&!('stock' in p))).toBe(true);
  const items=withSavedShopPrices([]);expect(destinationItems(items,'China')).toHaveLength(22);
  expect(shopQuote(items.find(i=>i.id===274),'China')?.buy_price).toBe(400);
  expect(shopQuote(items.find(i=>i.id===276),'China')?.buy_price).toBe(5000);
  expect(shopQuote(items.find(i=>i.id===247),'China')?.buy_price).toBe(16000);
  expect(shopQuote(items.find(i=>i.id===327),'China')).toMatchObject({shop:'Black Market',buy_price:20215,source:'User screenshot'});
  expect(shopQuote(items.find(i=>i.id===1494),'China')?.buy_price).toBe(166532);
  expect(shopQuote(items.find(i=>i.id===200),'China')?.buy_price).toBe(12028);
  expect(shopQuote(items.find(i=>i.id===200),'Mexico')?.buy_price).toBe(21731);
  expect(new Set(FOREIGN_SHOP_PRICES.map(p=>`${p.country}:${p.shop}:${p.id}`)).size).toBe(FOREIGN_SHOP_PRICES.length);
 });
});

describe('saved UAE purchase reference',()=>{
 it('retains all 15 screenshot observations including billion-dollar prices without implying stock',()=>{
  const rows=FOREIGN_SHOP_PRICES.filter(p=>p.country==='UAE');
  expect(rows).toHaveLength(15);
  expect(rows.filter(p=>p.shop==='General Store')).toHaveLength(7);
  expect(rows.filter(p=>p.shop==='Arms Dealer')).toHaveLength(3);
  expect(rows.filter(p=>p.shop==='Black Market')).toHaveLength(5);
  expect(rows.every(p=>p.observed_on==='2026-11-12'&&!('stock' in p))).toBe(true);
  const items=withSavedShopPrices([]);expect(destinationItems(items,'UAE')).toHaveLength(15);
  expect(shopQuote(items.find(i=>i.id===381),'UAE')?.buy_price).toBe(8000000000);
  expect(shopQuote(items.find(i=>i.id===386),'UAE')?.buy_price).toBe(14000000000);
  expect(shopQuote(items.find(i=>i.id===382),'UAE')?.buy_price).toBe(25000000000);
  expect(shopQuote(items.find(i=>i.id===387),'UAE')?.buy_price).toBe(16000000000);
  expect(shopQuote(items.find(i=>i.id===388),'UAE')?.buy_price).toBe(23000000000);
  expect(shopQuote(items.find(i=>i.id===1264),'UAE')?.buy_price).toBe(3800);
  expect(shopQuote(items.find(i=>i.id===385),'UAE')?.buy_price).toBe(6000);
  expect(shopQuote(items.find(i=>i.id===1495),'UAE')?.buy_price).toBe(358740);
  expect(shopQuote(items.find(i=>i.id===204),'UAE')?.buy_price).toBe(569);
  expect(shopQuote(items.find(i=>i.id===204),'China')?.buy_price).toBe(5433);
  expect(new Set(FOREIGN_SHOP_PRICES.map(p=>`${p.country}:${p.shop}:${p.id}`)).size).toBe(FOREIGN_SHOP_PRICES.length);
 });
});

describe('saved Japan purchase reference',()=>{
 it('offers all screenshot prices as fallbacks without claiming live stock',()=>{
  const rows=FOREIGN_SHOP_PRICES.filter(p=>p.country==='Japan');
  expect(rows).toHaveLength(27);
  expect(rows.filter(p=>p.shop==='General Store')).toHaveLength(11);
  expect(rows.filter(p=>p.shop==='Arms Dealer')).toHaveLength(9);
  expect(rows.filter(p=>p.shop==='Black Market')).toHaveLength(7);
  expect(rows.every(p=>p.observed_on==='2026-11-14'&&p.source==='User screenshot'&&!('stock' in p))).toBe(true);
  const items=withSavedShopPrices([]);
  expect(destinationItems(items,'Japan')).toHaveLength(27);
  expect(shopQuote(items.find(i=>i.id===1333),'Japan')?.buy_price).toBe(220000);
  expect(shopQuote(items.find(i=>i.id===334),'Japan')?.buy_price).toBe(15000000);
  expect(shopQuote(items.find(i=>i.id===277),'Japan')?.buy_price).toBe(500);
  expect(shopQuote(items.find(i=>i.id===1249),'Japan')?.buy_price).toBe(24500);
  expect(shopQuote(items.find(i=>i.id===1492),'Japan')?.buy_price).toBe(25536);
  expect(shopQuote(items.find(i=>i.id===1493),'Japan')?.buy_price).toBe(2120);
  expect(shopQuote(items.find(i=>i.id===206),'Japan')?.buy_price).toBe(648790);
  expect(shopQuote(items.find(i=>i.id===205),'Japan')?.buy_price).toBe(6019);
  expect(shopQuote(items.find(i=>i.id===205),'UAE')?.buy_price).toBe(5550);
  expect(new Set(FOREIGN_SHOP_PRICES.map(p=>`${p.country}:${p.shop}:${p.id}`)).size).toBe(FOREIGN_SHOP_PRICES.length);
 });
});
