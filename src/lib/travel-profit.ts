/** Official route reference, checked 2026-10-22 against Torn Wiki Travel.
 * These are planning estimates, not account observations. Standard fare is per paid leg.
 * https://wiki.torn.com/wiki/Travel — no runtime third-party connections.
 */
export type FlyMethod = 'Standard'|'Airstrip'|'Private'|'Business';
export const METHODS:FlyMethod[]=['Standard','Airstrip','Private','Business'];
export const ROUTES = [
  {country:'Mexico',minutes:[24,17,12,7],fare:6500},
  {country:'Cayman Islands',minutes:[33,23,17,10],fare:10000},
  {country:'Canada',minutes:[39,27,19,12],fare:9000},
  {country:'Hawaii',minutes:[127,89,63,38],fare:11000},
  {country:'United Kingdom',minutes:[151,106,75,45],fare:18000},
  {country:'Argentina',minutes:[158,111,79,47],fare:21000},
  {country:'Switzerland',minutes:[166,116,83,50],fare:27000},
  {country:'Japan',minutes:[213,149,107,64],fare:32000},
  {country:'China',minutes:[229,160,114,69],fare:35000},
  {country:'UAE',minutes:[257,180,128,77],fare:32000},
  {country:'South Africa',minutes:[282,197,141,85],fare:40000},
];
const object=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{};
export const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
export type ShopItem={id:number;name:string;type:string;value:{shops:{country:string;shop:string;buy_price:number|null}[]}};
export function shopItems(payload:unknown):ShopItem[]{
  const rows=object(payload).items;
  return Array.isArray(rows)?rows.filter((r:any)=>Number.isSafeInteger(r?.id)&&r.id>0&&typeof r.name==='string'&&typeof r.type==='string'&&Array.isArray(r.value?.shops)):[];
}
export function shopQuote(item:ShopItem|undefined,country:string){
  const valid=(item?.value.shops??[]).filter(s=>s.country===country&&finite(s.buy_price)&&s.buy_price>=0);
  if(!valid.length)return null;
  return [...valid].sort((a,b)=>a.buy_price!-b.buy_price!)[0];
}
export function destinationItems(items:ShopItem[],country:string,category?:string){
  return items.filter(i=>shopQuote(i,country)!==null&&(!category||i.type===category)).sort((a,b)=>a.name.localeCompare(b.name));
}
export function marketMinimum(payload:unknown):{price:number|null;count:number;cacheTime:number|null}{
  const market=object(object(payload).itemmarket);
  const valid=Array.isArray(market.listings)?market.listings.filter((r:any)=>finite(r?.price)&&r.price>=0&&finite(r?.amount)&&r.amount>0):[];
  return {price:valid.length?Math.min(...valid.map((r:any)=>r.price)):null,count:valid.length,cacheTime:finite(market.cache_timestamp)?market.cache_timestamp:null};
}
export function flightEstimate(country:string,method:FlyMethod,travelPayload:unknown,book=false){
  const travel=object(object(travelPayload).travel);
  if(travel.destination===country&&travel.method===method&&finite(travel.departed_at)&&finite(travel.arrival_at)&&travel.arrival_at>travel.departed_at){
    return {minutes:(travel.arrival_at-travel.departed_at)/60,source:'Observed outbound duration; return estimated equal'};
  }
  const route=ROUTES.find(r=>r.country===country);
  return {minutes:route?route.minutes[METHODS.indexOf(method)]*(book ? 0.75 : 1):null,source:'Official route estimate; flight variance and personal effects can differ'};
}
export function tripCost(country:string,method:FlyMethod,paidLegs:number,businessTicket:number|null){
  if(method==='Private'||method==='Airstrip'||paidLegs===0)return 0;
  if(method==='Business')return businessTicket===null?null:businessTicket*paidLegs;
  const route=ROUTES.find(r=>r.country===country);return route?route.fare*paidLegs:null;
}
export function travelProfit({buy,sell,quantity,cost,roundTripMinutes,waitMinutes,feePercent}:{buy:number|null;sell:number|null;quantity:number;cost:number|null;roundTripMinutes:number|null;waitMinutes:number;feePercent:number}){
  if(buy===null||sell===null||cost===null||roundTripMinutes===null||![buy,sell,cost,quantity,roundTripMinutes,waitMinutes,feePercent].every(Number.isFinite)||buy<0||sell<0||cost<0||!Number.isSafeInteger(quantity)||quantity<1||roundTripMinutes<=0||waitMinutes<0||feePercent<0||feePercent>100)return null;
  const gross=sell*quantity,fee=gross*feePercent/100,profit=gross-fee-buy*quantity-cost,totalMinutes=roundTripMinutes+waitMinutes;
  return {gross,fee,profit,perItem:sell*(1-feePercent/100)-buy,perHour:profit*60/totalMinutes,totalMinutes};
}
