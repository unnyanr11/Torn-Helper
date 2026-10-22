import SelectEntry from "./SelectEntry";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CAPABILITIES } from '../api/capabilities';
import { supabase } from '../lib/supabase';
import { functionError } from '../lib/function-error';
import { useTornChoices } from '../hooks/useTornChoices';
import { type CachedChoiceRow } from '../lib/torn-choices';
import { createTravelClient, scanItemMarket, type MarketScan } from '../lib/travel-client';
import { destinationItems, flightEstimate, METHODS, ROUTES, shopItems, shopQuote, travelProfit, tripCost, type FlyMethod } from '../lib/travel-profit';
import type { TornObservation } from '../lib/personal-data';
import KeyDisclosure from './KeyDisclosure';
const endpoint=(path:string)=>CAPABILITIES.find(c=>c.path===path)!.id;
const money=(n:number|null)=>n===null?'Unavailable':`$${n.toLocaleString(undefined,{maximumFractionDigits:2})}`;
type Quote={itemId:string;country:string;detail:TornObservation;market:MarketScan};
type Saved={id:string;destination:string;item_name:string;profit_total:number;profit_per_hour:number;flight_minutes:number};
export default function TravelProfitTool(){
 const cache=useTornChoices(),queryClient=useQueryClient();
 const [country,setCountry]=useState('Mexico'),[category,setCategory]=useState(''),[itemId,setItemId]=useState('');
 const [mode,setMode]=useState('request'),[key,setKey]=useState('');
 const [method,setMethod]=useState<FlyMethod>('Standard'),[quantity,setQuantity]=useState(10),[paidLegs,setPaidLegs]=useState(2),[fee,setFee]=useState(5),[waiting,setWaiting]=useState(0),[book,setBook]=useState(false);
 const [costOverride,setCostOverride]=useState(''),[timeOverride,setTimeOverride]=useState('');
 const [quote,setQuote]=useState<Quote|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[revision,setRevision]=useState(0),[error,setError]=useState(''),[saveMessage,setSaveMessage]=useState(''),[saving,setSaving]=useState(false),[saved,setSaved]=useState<Saved[]>([]);
 const [businessPrice,setBusinessPrice]=useState<number|null>(null),[businessTime,setBusinessTime]=useState('');
 const businessController=useRef<AbortController|null>(null);
 const pending=useRef<AbortController|null>(null),loadingController=useRef<AbortController|null>(null);
 const fetchSection=useMemo(()=>createTravelClient(async(id,parameters,apiKey,signal)=>{
   const r=await supabase.functions.invoke('torn-data',{body:{endpoint_id:id,parameters,...(apiKey===undefined?{}:{apiKey})},signal});
   if(r.error||r.data?.error)throw await functionError(r.data,r.error);
   return r.data;
 }),[]);
 const ready=mode==='stored'||/^[A-Za-z0-9]{16}$/.test(key);
 const apiKey=mode==='request'?key:undefined;
 const rows=cache.data??[];
 const items=useMemo(()=>{
  const byId=new Map<number,ReturnType<typeof shopItems>[number]>();
  for(const row of rows)if([endpoint('/torn/items'),endpoint('/torn/{ids}/items')].includes(row.endpoint_id))for(const item of shopItems(row.payload))if(!byId.has(item.id))byId.set(item.id,item);
  return [...byId.values()];
 },[cache.data]);
 const travelRow=rows.find(r=>r.endpoint_id===endpoint('/user/travel'));
 useEffect(()=>{const travel=(travelRow?.payload as any)?.travel;if(METHODS.includes(travel?.method))setMethod(travel.method);},[travelRow?.fetched_at]);
 const available=destinationItems(items,country),categories=[...new Set(available.map(i=>i.type))].sort();
 const chosen=destinationItems(items,country,category).find(i=>String(i.id)===itemId);
 const current=quote?.itemId===itemId&&quote.country===country?quote:null;
 const detailItem=current?shopItems(current.detail.payload).find(i=>String(i.id)===itemId):undefined;
 const buy=shopQuote(detailItem??chosen,country);
 const flight=flightEstimate(country,method,travelRow?.payload,book);
 const businessId=items.find(i=>i.name.toLowerCase()==='business class ticket')?.id;
 const estimatedCost=tripCost(country,method,paidLegs,businessPrice);
 const cost=costOverride.trim()!==''?Number(costOverride):estimatedCost;
 const roundTrip=timeOverride.trim()!==''?Number(timeOverride):flight.minutes===null?null:flight.minutes*2;
 const sell=current&&current.market.cacheTimes.length<=1?current.market.price:null;
 const result=travelProfit({buy:buy?.buy_price??null,sell,quantity,cost,roundTripMinutes:roundTrip,waitMinutes:waiting,feePercent:fee});
 const displayResult=!busy?result:null;
 function storeObservation(r:TornObservation){queryClient.setQueryData<CachedChoiceRow[]>(['torn-choices'],old=>[{endpoint_id:r.endpoint_id,payload:r.payload,fetched_at:r.fetched_at},...(old??[])].slice(0,100));}
 async function loadSaved(){const r=await supabase.from('travel_profit_scenarios').select('id,destination,item_name,profit_total,profit_per_hour,flight_minutes').order('created_at',{ascending:false}).limit(25);if(r.error)throw r.error;setSaved(r.data??[]);}
 useEffect(()=>{let alive=true;void supabase.from('travel_profit_scenarios').select('id,destination,item_name,profit_total,profit_per_hour,flight_minutes').order('created_at',{ascending:false}).limit(25).then(r=>{if(alive){if(r.error)setSaveMessage(r.error.message);else setSaved(r.data??[]);}});return()=>{alive=false;pending.current?.abort();loadingController.current?.abort();businessController.current?.abort();};},[]);
 async function loadData(){
  loadingController.current?.abort();const control=new AbortController();loadingController.current=control;setLoading(true);setError('');
  const failures:string[]=[];
  for(const path of ['/torn/items','/user/travel']){
   try{
    const r=await fetchSection(path,path==='/torn/items'?{cat:'All'}:{},apiKey,control.signal);if(control.signal.aborted)return;storeObservation(r);
    if(path==='/user/travel'){
     const travel=(r.payload as any)?.travel;
     if(METHODS.includes(travel?.method))setMethod(travel.method);
     
    }
   }catch(e){if(control.signal.aborted)return;failures.push(e instanceof Error?e.message:'Unable to load data.');}
  }
  if(!control.signal.aborted){setLoading(false);setError(failures.join(' '));}
 }
 useEffect(()=>{
  pending.current?.abort();const control=new AbortController();pending.current=control;setQuote(null);setBusy(false);setError('');setSaveMessage('');
  if(!itemId||!ready)return()=>control.abort();
  const timer=setTimeout(()=>{void(async()=>{
   setBusy(true);
   try{
    if(!travelRow?.fetched_at||Date.now()-Date.parse(travelRow.fetched_at)>60000){
      try{const personal=await fetchSection('/user/travel',{},apiKey,control.signal);if(control.signal.aborted)return;storeObservation(personal);}
      catch(e){if(control.signal.aborted)return;setError(`Travel details could not be refreshed; route assumptions remain editable. ${e instanceof Error?e.message:''}`);}
    }
    const detail=await fetchSection('/torn/{ids}/items',{ids:itemId},apiKey,control.signal);
    if(control.signal.aborted)return;storeObservation(detail);
    const market=await scanItemMarket(Number(itemId),p=>fetchSection('/market/{id}/itemmarket',p,apiKey,control.signal),control.signal);
    if(!control.signal.aborted)setQuote({itemId,country,detail,market});
   }catch(e){if(!control.signal.aborted)setError(e instanceof Error?e.message:'Unable to fetch prices.');}
   finally{if(!control.signal.aborted)setBusy(false);}
  })();},450);
  return()=>{clearTimeout(timer);control.abort();};
 },[itemId,country,mode,key,revision]);
 useEffect(()=>{
  businessController.current?.abort();const control=new AbortController();businessController.current=control;setBusinessPrice(null);setBusinessTime('');
  if(method!=='Business'||!businessId||!ready||paidLegs===0)return()=>control.abort();
  void scanItemMarket(businessId,p=>fetchSection('/market/{id}/itemmarket',p,apiKey,control.signal),control.signal).then(scan=>{if(!control.signal.aborted&&scan.cacheTimes.length<=1){setBusinessPrice(scan.price);setBusinessTime(scan.fetched_at);}}).catch(()=>{});
  return()=>control.abort();
 },[method,businessId,mode,key,revision,paidLegs]);
 async function scanMore(){
  if(!current||busy)return;const control=new AbortController();pending.current?.abort();pending.current=control;setBusy(true);setError('');
  try{const market=await scanItemMarket(Number(itemId),p=>fetchSection('/market/{id}/itemmarket',p,apiKey,control.signal),control.signal,current.market);if(!control.signal.aborted)setQuote({...current,market});}
  catch(e){if(!control.signal.aborted)setError(e instanceof Error?e.message:'Unable to scan further listings.');}
  finally{if(!control.signal.aborted)setBusy(false);}
 }
 async function save(){
  if(!displayResult||!chosen||cost===null||roundTrip===null||sell===null||buy?.buy_price===null||buy?.buy_price===undefined)return;
  setSaving(true);setSaveMessage('');
  try{const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Sign in to save an estimate.');
   const r=await supabase.from('travel_profit_scenarios').insert({user_id:user.id,destination:country,item_name:chosen.name,buy_price:buy.buy_price,sell_price:sell,quantity,travel_cost:cost,flight_minutes:Math.ceil(displayResult.totalMinutes),profit_total:displayResult.profit,profit_per_hour:displayResult.perHour});if(r.error)throw r.error;await loadSaved();setSaveMessage('Estimate saved.');
  }catch(e){setSaveMessage(e instanceof Error?e.message:'Unable to save estimate.');}finally{setSaving(false);}
 }
 return <section className="travel-profit-tool"><h2>Travel profit calculator</h2><p>Choose a location, category and item. Prices refresh automatically after you choose an item.</p>
  <details className="card" open={!ready}><summary>Torn key and data refresh</summary><label>Key to use<select className="nu-input" value={mode} onChange={e=>{setMode(e.target.value);setKey('');}}><option value="request">Use a key on this page</option><option value="stored">Use my saved encrypted key</option></select></label>{mode==='request'&&<><label>Torn API key<input className="nu-input" type="password" autoComplete="off" maxLength={16} spellCheck={false} value={key} onChange={e=>setKey(e.target.value.trim())}/></label><p>The key stays in page memory for automatic price updates and is cleared when you leave. It is never saved in browser storage.</p><details><summary>Key privacy details</summary><KeyDisclosure persist={false} session/></details></>}<button className="nu-btn" disabled={!ready||loading} onClick={()=>void loadData()}>{loading?'Loading items and travel…':'Load items and my travel'}</button></details>
  {cache.error&&<p role="alert">Saved item choices could not be restored. Load items to try again.</p>}
  {error&&<p role="alert">{error}</p>}
  <article className="card"><div className="travel-fields"><label>Location<select className="nu-input" value={country} onChange={e=>{setCountry(e.target.value);setCategory('');setItemId('');setCostOverride('');setTimeOverride('');}}>{ROUTES.map(r=><option key={r.country}>{r.country}</option>)}</select></label>
  <label>Item category<select className="nu-input" value={category} disabled={!categories.length} onChange={e=>{setCategory(e.target.value);setItemId('');}}><option value="">Choose a category…</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
  <label>Item<select className="nu-input" value={itemId} disabled={!category} onChange={e=>setItemId(e.target.value)}><option value="">Choose an item…</option>{category&&destinationItems(items,country,category).map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
  <label>Quantity to bring<select className="nu-input" value={quantity} onChange={e=>setQuantity(Number(e.target.value))}>{Array.from({length:100},(_,i)=><option key={i+1}>{i+1}</option>)}</select></label>
  <label>Travel method<select className="nu-input" value={method} onChange={e=>{setMethod(e.target.value as FlyMethod);setCostOverride('');setTimeOverride('');}}>{METHODS.map(m=><option key={m}>{m}</option>)}</select></label>
  <label>Selling fee<select className="nu-input" value={fee} onChange={e=>setFee(Number(e.target.value))}>{[0,5,10,15].map(n=><option key={n} value={n}>{n}%{n===5?' · regular item market':n===0?' · fee-free assumption':''}</option>)}</select></label></div>
  {!items.length&&<p>Load item data above to populate categories and items.</p>}{!!items.length&&!available.length&&<p>No destination shop prices were returned for this location.</p>}
  <p>Quantity is your planned purchase, not a fetched carrying-capacity limit. Check your actual capacity and stock in game.</p>
  <button className="nu-btn" disabled={!itemId||!ready||busy} onClick={()=>setRevision(n=>n+1)}>{busy?'Fetching prices…':'Refresh item prices'}</button>
  <details><summary>Travel costs and timing</summary><p>{travelRow?`Travel observation: ${new Date(travelRow.fetched_at??0).toLocaleString()}. Method is filled from your returned travel record.`:'Load my travel to fill your last/current flight method.'} The travel API does not return your charged fare.</p><p>Airstrip/private cash fares are estimated at zero, excluding property/stock overhead. Standard fares use the official route reference. Business ticket budgets use a fetched ticket listing price when available; a free business perk can be represented with zero paid tickets.</p>
  {businessTime&&<p>Business-ticket market estimate observed {new Date(businessTime).toLocaleString()}: {money(businessPrice)} each. This values tickets consumed; it is not a charged airfare.</p>}
  <div className="travel-fields"><label>Paid legs / tickets budgeted<select className="nu-input" value={paidLegs} onChange={e=>setPaidLegs(Number(e.target.value))}>{[0,1,2].map(n=><option key={n}>{n}</option>)}</select></label><label>Shopping / waiting time<select className="nu-input" value={waiting} onChange={e=>setWaiting(Number(e.target.value))}>{[0,5,10,15,30,60,120].map(n=><option key={n} value={n}>{n} minutes</option>)}</select></label><label>Travel-time book assumption<select className="nu-input" value={book?'yes':'no'} onChange={e=>setBook(e.target.value==='yes')}><option value="no">No book reduction</option><option value="yes">25% reduction · estimated routes only</option></select></label><label>Total trip travel cost override ($)<SelectEntry label="Travel cost override ($)" kind="money" className="nu-input" type="number" min="0" step="1" options={estimatedCost===null?[]:[{value:String(estimatedCost),label:`Estimated: ${estimatedCost.toLocaleString()}`}]} value={costOverride} onChange={e=>setCostOverride(e.target.value)} emptyText="Use calculated cost"/></label><label>Round-trip flight time override (minutes)<SelectEntry label="Round-trip time override (minutes)" kind="minutes" className="nu-input" type="number" min="0.01" step="any" options={flight.minutes===null?[]:[{value:String(flight.minutes*2),label:`Calculated: ${flight.minutes*2} minutes`}]} value={timeOverride} onChange={e=>setTimeOverride(e.target.value)} emptyText="Use calculated duration"/></label></div></details>
  </article>
  {itemId&&<article className="card"><h3>{chosen?.name??'Selected item'} · {country}</h3><dl className="data-metrics"><div><dt>Foreign shop price per item</dt><dd>{money(buy?.buy_price??null)}</dd></div><div><dt>{current?.market.complete?'Lowest scanned item-market price':'Lowest observed item-market price'}</dt><dd>{money(sell)}</dd></div><div><dt>Total travel cost · {costOverride!==''?'your override':'estimate'}</dt><dd>{money(cost)}</dd></div><div><dt>Round-trip flight time</dt><dd>{roundTrip===null?'Unknown':`${roundTrip.toLocaleString(undefined,{maximumFractionDigits:2})} minutes`}</dd></div></dl>
  {current&&<p>Shop: {buy?.shop??'Not returned'}. Item catalogue collected {new Date(current.detail.fetched_at).toLocaleString()}. Market checked {current.market.count} listings across {current.market.pages} pages; {current.market.complete?'all returned pages scanned':'more pages remain'}. Market cache times: {current.market.cacheTimes.map(t=>new Date(t*1000).toLocaleString()).join(', ')||'not provided'}.</p>}
  {current?.market.cacheTimes.length!==undefined&&current.market.cacheTimes.length>1&&<p role="alert">Market cache changed during scanning. Refresh prices before using this estimate.</p>}
  {current&&!current.market.complete&&<button className="nu-btn" disabled={busy||!ready} onClick={()=>void scanMore()}>Scan more market pages</button>}
  <p>{timeOverride!==''?'Using your round-trip time override.':flight.source} Profit per hour includes both flight legs plus your selected waiting time.</p>
  {displayResult?<><div className="personal-summary"><article><span>Estimated profit per item after selling fee</span><strong>{money(displayResult.perItem)}</strong></article><article><span>Estimated trip profit</span><strong>{money(displayResult.profit)}</strong></article><article><span>Estimated profit per hour</span><strong>{money(displayResult.perHour)}/hr</strong></article></div><p>({money(sell)} × {quantity}) − {money(displayResult.fee)} selling fee − ({money(buy?.buy_price??null)} × {quantity}) − {money(cost)} travel cost, over {displayResult.totalMinutes.toLocaleString()} minutes. Listing prices are asking prices, not guaranteed proceeds. Shop stock and sale waiting time are not supplied by these price endpoints.</p><button className="nu-btn" disabled={saving} onClick={()=>void save()}>{saving?'Saving…':'Save this estimate'}</button></>:!busy&&<p>Profit remains unavailable until buy price, market price, travel cost and a valid trip time are known.{method==='Business'&&cost===null?' Enter the total business ticket budget under Travel costs and timing.':''}</p>}
  </article>}
  {saveMessage&&<p role="status">{saveMessage}</p>}
  {!!saved.length&&<details className="card"><summary>Saved estimates ({saved.length})</summary><div className="table-scroll"><table><thead><tr><th>Location</th><th>Item</th><th>Profit</th><th>Profit / hour</th></tr></thead><tbody>{saved.map(s=><tr key={s.id}><td>{s.destination}</td><td>{s.item_name}</td><td>{money(s.profit_total)}</td><td>{money(s.profit_per_hour)}</td></tr>)}</tbody></table></div><p>Saved estimates use the prices and assumptions from when they were saved.</p></details>}
 </section>;
}
