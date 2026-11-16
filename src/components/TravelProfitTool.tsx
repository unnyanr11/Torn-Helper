import {useForeignStock} from '../hooks/useForeignStock';
import {travelCapacity} from '../lib/travel-capacity';
import DataFreshness from './DataFreshness';
import RequestProblem from './RequestProblem';
import { useTornKeyMode } from '../hooks/useTornKeyMode';
import PriceUpdateRequests from './PriceUpdateRequests';
import { useForeignShopPrices } from '../hooks/useForeignShopPrices';
import SelectEntry from "./SelectEntry";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CAPABILITIES } from '../api/capabilities';
import { invokeTornData } from '../lib/torn-data-client';
import { supabase } from '../lib/supabase';
import { functionError } from '../lib/function-error';
import { useTornChoices } from '../hooks/useTornChoices';
import { createTravelClient, scanItemMarket, type MarketScan } from '../lib/travel-client';
import { destinationItems, flightEstimate, METHODS, ROUTES, shopItems, shopQuote, travelProfit, tripCost, withSavedShopPrices, type FlyMethod } from '../lib/travel-profit';
import type { TornObservation } from '../lib/personal-data';
import TornConnectionPanel from './TornConnectionPanel';
const endpoint=(path:string)=>CAPABILITIES.find(c=>c.path===path)!.id;
const money=(n:number|null)=>n===null?'Unavailable':`$${n.toLocaleString(undefined,{maximumFractionDigits:2})}`;
type Quote={itemId:string;country:string;detail:TornObservation;market:MarketScan};
type Saved={id:string;destination:string;item_name:string;profit_total:number;profit_per_hour:number;flight_minutes:number};
export default function TravelProfitTool(){
 const stock=useForeignStock();
 const cache=useTornChoices(),queryClient=useQueryClient(),references=useForeignShopPrices();
 const previous=queryClient.getQueryData<{country:string;category:string;itemId:string;method:FlyMethod;quantity:number;paidLegs:number;fee:number;waiting:number;book:boolean;quote:Quote|null;costOverride:string;timeOverride:string;businessPrice:number|null;businessTime:string}>(['travel-workspace']);
 const [country,setCountry]=useState(previous?.country??'Mexico'),[category,setCategory]=useState(previous?.category??''),[itemId,setItemId]=useState(previous?.itemId??'');
 const [mode,setMode]=useTornKeyMode(),[key,setKey]=useState('');
 const [method,setMethod]=useState<FlyMethod>(previous?.method??'Standard'),[quantity,setQuantity]=useState(previous?.quantity??10),[paidLegs,setPaidLegs]=useState(previous?.paidLegs??2),[fee,setFee]=useState(previous?.fee??5),[waiting,setWaiting]=useState(previous?.waiting??0),[book,setBook]=useState(previous?.book??false);
 const [costOverride,setCostOverride]=useState(previous?.costOverride??''),[timeOverride,setTimeOverride]=useState(previous?.timeOverride??'');
 const [quote,setQuote]=useState<Quote|null>(previous?.quote??null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[revision,setRevision]=useState(0),[error,setError]=useState(''),[saveMessage,setSaveMessage]=useState(''),[saving,setSaving]=useState(false),[saved,setSaved]=useState<Saved[]>([]);

 const [manualCapacity,setManualCapacity]=useState<number|null>(null),[tourism,setTourism]=useState(false);
 const [businessPrice,setBusinessPrice]=useState<number|null>(previous?.businessPrice??null),[businessTime,setBusinessTime]=useState(previous?.businessTime??'');
 useEffect(()=>{queryClient.setQueryData(['travel-workspace'],{country,category,itemId,method,quantity,paidLegs,fee,waiting,book,quote,costOverride,timeOverride,businessPrice,businessTime});},[country,category,itemId,method,quantity,paidLegs,fee,waiting,book,quote,costOverride,timeOverride,businessPrice,businessTime]);
 const businessController=useRef<AbortController|null>(null);
 const pending=useRef<AbortController|null>(null),loadingController=useRef<AbortController|null>(null);
 const fetchSection=useMemo(()=>createTravelClient(async(id,parameters,apiKey,signal)=>{
   const r=await invokeTornData(queryClient,{body:{endpoint_id:id,parameters,...(apiKey===undefined?{}:{apiKey})},signal});
   if(r.error||r.data?.error)throw await functionError(r.data,r.error);
   return r.data;
 }),[]);
 const ready=mode==='stored'||/^[A-Za-z0-9]{16}$/.test(key);
 const apiKey=mode==='request'?key:undefined;
 const rows=cache.data??[];
 const items=useMemo(()=>{
  const byId=new Map<number,ReturnType<typeof shopItems>[number]>();
  for(const row of rows)if([endpoint('/torn/items'),endpoint('/torn/{ids}/items')].includes(row.endpoint_id))for(const item of shopItems(row.payload))if(!byId.has(item.id))byId.set(item.id,item);
  return withSavedShopPrices([...byId.values()],references.prices);
 },[cache.data,references.data]);
 const travelRow=rows.find(r=>r.endpoint_id===endpoint('/user/travel'));
 useEffect(()=>{const travel=(travelRow?.payload as any)?.travel;if(METHODS.includes(travel?.method))setMethod(travel.method);},[travelRow?.fetched_at]);
 const available=destinationItems(items,country),categories=[...new Set(available.map(i=>i.type))].sort();
 const chosen=destinationItems(items,country,category).find(i=>String(i.id)===itemId);
 const perksRow=rows.find(r=>r.endpoint_id===endpoint('/user/perks'));
 const detectedCapacity=travelCapacity(perksRow?.payload,method,chosen?.type??category,tourism);
 const capacity=manualCapacity??detectedCapacity?.capacity??(method==='Standard'?10:15);
 useEffect(()=>{setQuantity(q=>Math.min(q,capacity));},[capacity]);
 const report=(destination:string)=>stock.data?.rows.find(r=>r.country===destination&&String(r.id)===itemId);
 const selectedStock=report(country);
 const stockFresh=selectedStock&&Date.now()-Date.parse(selectedStock.observed_at)<300000;
 const current=quote?.itemId===itemId&&quote.country===country?quote:null;
 const detailItem=current?shopItems(current.detail.payload).find(i=>String(i.id)===itemId):undefined;
 const buy=stockFresh?{buy_price:selectedStock.cost,shop:'Community stock report',source:stock.data!.source,observed_on:selectedStock.observed_at}:shopQuote(detailItem,country)??shopQuote(chosen,country);
 const savedPrices=references.prices.filter(p=>p.country===country);
 const flight=flightEstimate(country,method,travelRow?.payload,book);
 const businessId=items.find(i=>i.name.toLowerCase()==='business class ticket')?.id;
 const estimatedCost=tripCost(country,method,paidLegs,businessPrice);
 const cost=costOverride.trim()!==''?Number(costOverride):estimatedCost;
 const roundTrip=timeOverride.trim()!==''?Number(timeOverride):flight.minutes===null?null:flight.minutes*2;
 const sell=current&&current.market.cacheTimes.length<=1?current.market.price:null;
 const result=travelProfit({buy:buy?.buy_price??null,sell,quantity:Math.min(quantity,capacity),cost,roundTripMinutes:roundTrip,waitMinutes:waiting,feePercent:fee});
 const insufficientStock=stockFresh&&selectedStock.quantity<quantity;
 const displayResult=!busy&&!insufficientStock?result:null;

 async function loadSaved(){const r=await supabase.from('travel_profit_scenarios').select('id,destination,item_name,profit_total,profit_per_hour,flight_minutes').order('created_at',{ascending:false}).limit(25);if(r.error)throw r.error;setSaved(r.data??[]);}
 useEffect(()=>{let alive=true;void supabase.from('travel_profit_scenarios').select('id,destination,item_name,profit_total,profit_per_hour,flight_minutes').order('created_at',{ascending:false}).limit(25).then(r=>{if(alive){if(r.error)setSaveMessage(r.error.message);else setSaved(r.data??[]);}});return()=>{alive=false;pending.current?.abort();loadingController.current?.abort();businessController.current?.abort();};},[]);
 async function loadData(){
  loadingController.current?.abort();const control=new AbortController();loadingController.current=control;setLoading(true);setError('');
  const failures:string[]=[];
  for(const path of ['/torn/items','/user/travel','/user/perks']){
   try{
    const r=await fetchSection(path,path==='/torn/items'?{cat:'All'}:{},apiKey,control.signal);if(control.signal.aborted)return;
    if(path==='/user/travel'){
     const travel=(r.payload as any)?.travel;
     if(METHODS.includes(travel?.method))setMethod(travel.method);
     
    }
   }catch(e){if(control.signal.aborted)return;failures.push(e instanceof Error?e.message:'Unable to load data.');}
  }
  if(!control.signal.aborted){setLoading(false);setError(failures.join(' '));}
 }
 useEffect(()=>{
  pending.current?.abort();const control=new AbortController();pending.current=control;setQuote(old=>old?.itemId===itemId&&old.country===country?old:null);setBusy(false);setError('');setSaveMessage('');
  if(!itemId||!ready)return()=>control.abort();
  const timer=setTimeout(()=>{void(async()=>{
   setBusy(true);
   try{
    if(!travelRow?.fetched_at||Date.now()-Date.parse(travelRow.fetched_at)>60000){
      try{await fetchSection('/user/travel',{},apiKey,control.signal);if(control.signal.aborted)return;}
      catch(e){if(control.signal.aborted)return;setError(`Travel details could not be refreshed; route assumptions remain editable. ${e instanceof Error?e.message:''}`);}
    }
    const detail=await fetchSection('/torn/{ids}/items',{ids:itemId},apiKey,control.signal);
    if(control.signal.aborted)return;
    const market=await scanItemMarket(Number(itemId),p=>fetchSection('/market/{id}/itemmarket',p,apiKey,control.signal),control.signal);
    if(!control.signal.aborted)setQuote({itemId,country,detail,market});
   }catch(e){if(!control.signal.aborted)setError(e instanceof Error?e.message:'Unable to fetch prices.');}
   finally{if(!control.signal.aborted)setBusy(false);}
  })();},450);
  return()=>{clearTimeout(timer);control.abort();};
 },[itemId,country,mode,key,revision]);
 useEffect(()=>{
  businessController.current?.abort();const control=new AbortController();businessController.current=control;
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
 return <section className="travel-profit-tool"><h2>Travel profit calculator</h2><p>Choose a location, category and item. Market prices refresh automatically after you choose an item. Saved shop references are available without a Torn request.</p>
  <PriceUpdateRequests key={`${country}:${itemId}`} country={country} itemId={Number(itemId)||undefined}/>
  <details className="card" open={!ready}><summary>Torn key and data refresh</summary><TornConnectionPanel mode={mode} onMode={setMode} keyValue={key} onKey={setKey} memory/>
  <button className="nu-btn" disabled={!ready||loading} onClick={()=>void loadData()}>{loading?'Loading items and travel…':'Load items and my travel'}</button></details>
  {references.isError&&<p role="alert">Owner-verified price updates could not load. Showing the last available references; refresh to retry.</p>}
  {cache.error&&<p role="alert">Saved item choices could not be restored. Load items to try again.</p>}
  {error&&<RequestProblem message={error} busy={busy||loading} onRetry={()=>{setRevision(n=>n+1);void loadData();}}/>}
  <article className="card"><div className="travel-fields"><label>Location<select className="nu-input" value={country} onChange={e=>{setCountry(e.target.value);setCategory('');setItemId('');setCostOverride('');setTimeOverride('');}}>{ROUTES.map(r=><option key={r.country}>{r.country}</option>)}</select></label>
  <label>Item category<select className="nu-input" value={category} disabled={!categories.length} onChange={e=>{setCategory(e.target.value);setItemId('');}}><option value="">Choose a category…</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
  <SelectEntry label="Item" searchable allowCustom={false} value={itemId} disabled={!category} onChange={e=>setItemId(e.target.value)} emptyText="Choose an item…" options={category?destinationItems(items,country,category).map(i=>({value:String(i.id),label:`${i.name} [${i.id}]`})):[]}/>
  <label>Your carrying capacity<input className="nu-input" type="number" min="1" max="100" value={capacity} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=100){setManualCapacity(n);setQuantity(q=>Math.min(q,n));}}}/></label><label>Quantity to bring<select className="nu-input" value={quantity} onChange={e=>setQuantity(Number(e.target.value))}>{Array.from({length:capacity},(_,i)=><option key={i+1}>{i+1}</option>)}</select></label>
  <label>Travel method<select className="nu-input" value={method} onChange={e=>{setMethod(e.target.value as FlyMethod);setCostOverride('');setTimeOverride('');}}>{METHODS.map(m=><option key={m}>{m}</option>)}</select></label>
  <label>Selling fee<select className="nu-input" value={fee} onChange={e=>setFee(Number(e.target.value))}>{[0,5,10,15].map(n=><option key={n} value={n}>{n}%{n===5?' · regular item market':n===0?' · fee-free assumption':''}</option>)}</select></label></div>
  {!items.length&&<p>Load item data above to populate categories and items.</p>}{!!items.length&&!available.length&&<p>No destination shop prices were returned for this location.</p>}
  {!!savedPrices.length&&<details><summary>Saved {country} shop prices ({savedPrices.length})</summary><p>Screenshot references observed on {[...new Set(savedPrices.map(p=>p.observed_on))].join(', ')}. Reference purchase prices only; Black Market prices are recorded observations. Live stock is not saved. A valid fetched shop price takes precedence.</p><div className="table-scroll"><table><thead><tr><th>Shop</th><th>Item</th><th>Type</th><th>Purchase price</th><th>Observed</th><th>Source</th></tr></thead><tbody>{savedPrices.map(p=><tr key={`${p.shop}-${p.id}`}><td>{p.shop}</td><td>{p.name}</td><td>{p.type}</td><td>{money(p.buy_price)}</td><td>{p.observed_on}</td><td>{p.source}</td></tr>)}</tbody></table></div></details>}
  <p>Capacity: {manualCapacity!==null?'your override':detectedCapacity?'calculated from saved Torn perks':'travel-method base estimate'}. Packed items also use slots; allow room for anything you take abroad.</p>
  <button className="nu-btn" onClick={()=>setManualCapacity(null)}>Use calculated capacity</button>
  <label><input type="checkbox" checked={tourism} onChange={e=>setTourism(e.target.checked)}/> Tourism Day is active for my account</label>
  <p>Enable the event bonus only during your personal Tourism Day window. Category-specific flower and plushie bonuses apply to the selected item.</p>
  {perksRow&&<DataFreshness at={perksRow.fetched_at} source="Torn perks · capacity estimate"/>}
  <article className="card"><h3>Foreign stock reports</h3>
   <button className="nu-btn" disabled={stock.isFetching} onClick={()=>void stock.refetch()}>Refresh foreign stock</button>
   {stock.isPending&&<p role="status">Loading community stock reports…</p>}
   {stock.isError&&<RequestProblem message="Foreign stock reports could not be refreshed." onRetry={()=>void stock.refetch()} busy={stock.isFetching}/>}
   {stock.data?.warning&&<p role="status">{stock.data.warning}</p>}
   {selectedStock?<><p>{selectedStock.quantity.toLocaleString()} reported in stock · {`$${selectedStock.cost.toLocaleString()}`} per item{!stockFresh?' · report is over five minutes old':''}</p><DataFreshness at={selectedStock.observed_at} source={stock.data!.source} busy={stock.isFetching}/></>:<p>No stock report for this selection.</p>}
   <p>Community observations can change before you arrive. Missing stock is unknown.</p>{insufficientStock&&<p role="alert">The recent report has fewer items than your planned purchase. Reduce the quantity before calculating profit.</p>}
   {stock.data?.source.includes('torn-tracker')?<p>Stock data from <a href="https://torn-tracker.com/guide/website/open-data/" target="_blank" rel="noopener noreferrer">Torn Tracker</a> · CC BY 4.0. Reports are filtered for this comparison.</p>:<p>Stock reports supplied by YATA.</p>}
  </article>
  <button className="nu-btn" disabled={!itemId||!ready||busy} onClick={()=>setRevision(n=>n+1)}>{busy?'Fetching prices…':'Refresh item prices'}</button>
  <details><summary>Travel costs and timing</summary><p>{travelRow?`Travel observation: ${new Date(travelRow.fetched_at??0).toLocaleString()}. Method is filled from your returned travel record.`:'Load my travel to fill your last/current flight method.'} The travel API does not return your charged fare.</p><p>Airstrip/private cash fares are estimated at zero, excluding property/stock overhead. Standard fares use the official route reference. Business ticket budgets use a fetched ticket listing price when available; a free business perk can be represented with zero paid tickets.</p>
  {businessTime&&<p>Business-ticket market estimate observed {new Date(businessTime).toLocaleString()}: {money(businessPrice)} each. This values tickets consumed; it is not a charged airfare.</p>}
  <div className="travel-fields"><label>Paid legs / tickets budgeted<select className="nu-input" value={paidLegs} onChange={e=>setPaidLegs(Number(e.target.value))}>{[0,1,2].map(n=><option key={n}>{n}</option>)}</select></label><label>Shopping / waiting time<select className="nu-input" value={waiting} onChange={e=>setWaiting(Number(e.target.value))}>{[0,5,10,15,30,60,120].map(n=><option key={n} value={n}>{n} minutes</option>)}</select></label><label>Travel-time book assumption<select className="nu-input" value={book?'yes':'no'} onChange={e=>setBook(e.target.value==='yes')}><option value="no">No book reduction</option><option value="yes">25% reduction · estimated routes only</option></select></label><label>Total trip travel cost override ($)<SelectEntry label="Travel cost override ($)" kind="money" className="nu-input" type="number" min="0" step="1" options={estimatedCost===null?[]:[{value:String(estimatedCost),label:`Estimated: ${estimatedCost.toLocaleString()}`}]} value={costOverride} onChange={e=>setCostOverride(e.target.value)} emptyText="Use calculated cost"/></label><label>Round-trip flight time override (minutes)<SelectEntry label="Round-trip time override (minutes)" kind="minutes" className="nu-input" type="number" min="0.01" step="any" options={flight.minutes===null?[]:[{value:String(flight.minutes*2),label:`Calculated: ${flight.minutes*2} minutes`}]} value={timeOverride} onChange={e=>setTimeOverride(e.target.value)} emptyText="Use calculated duration"/></label></div></details>
  </article>
  {itemId&&<article className="card"><h3>{chosen?.name??'Selected item'} · {country}</h3><p>Trip estimate · {method} · {quantity} items · {fee}% selling fee</p><dl className="data-metrics"><div><dt>Foreign shop price per item</dt><dd>{money(buy?.buy_price??null)}</dd></div><div><dt>{current?.market.complete?'Lowest scanned item-market price':'Lowest observed item-market price'}</dt><dd>{money(sell)}</dd></div><div><dt>Total travel cost · {costOverride!==''?'your override':'estimate'}</dt><dd>{money(cost)}</dd></div><div><dt>Round-trip flight time</dt><dd>{roundTrip===null?'Unknown':`${roundTrip.toLocaleString(undefined,{maximumFractionDigits:2})} minutes`}</dd></div><div><dt>Selling fees · total</dt><dd>{money(displayResult?.fee??null)}</dd></div><div><dt>Shopping / waiting</dt><dd>{waiting} minutes</dd></div><div><dt>Total time used for profit / hour</dt><dd>{displayResult?`${displayResult.totalMinutes.toLocaleString()} minutes`:'Unavailable'}</dd></div></dl>
  {buy?.source&&<p>Shop purchase price source: {buy.source}, shared {buy.observed_on}. Compare the source time with the latest stock report before flying.</p>}
  {current&&<p>Shop: {buy?.shop??'Not returned'}. Item catalogue collected {new Date(current.detail.fetched_at).toLocaleString()}. Market observed {new Date(current.market.fetched_at).toLocaleString()}. Checked {current.market.count} listings across {current.market.pages} pages; {current.market.complete?'all returned pages scanned':'more pages remain'}. Market cache times: {current.market.cacheTimes.map(t=>new Date(t*1000).toLocaleString()).join(', ')||'not provided'}.</p>}
  {current?.market.cacheTimes.length!==undefined&&current.market.cacheTimes.length>1&&<p role="alert">Market cache changed during scanning. Refresh prices before using this estimate.</p>}
  {current&&!current.market.complete&&<button className="nu-btn" disabled={busy||!ready} onClick={()=>void scanMore()}>Scan more market pages</button>}
  <p>{timeOverride!==''?'Using your round-trip time override.':flight.source} Profit per hour includes both flight legs plus your selected waiting time.</p>
  {displayResult?<><div className="personal-summary"><article><span>Estimated profit per item after selling fee</span><strong>{money(displayResult.perItem)}</strong></article><article><span>Estimated trip profit</span><strong>{money(displayResult.profit)}</strong></article><article><span>Estimated profit per minute</span><strong>{money(displayResult.perHour/60)}/min</strong></article><article><span>Estimated profit per hour</span><strong>{money(displayResult.perHour)}/hr</strong></article></div><p>({money(sell)} × {quantity}) − {money(displayResult.fee)} selling fee − ({money(buy?.buy_price??null)} × {quantity}) − {money(cost)} travel cost, over {displayResult.totalMinutes.toLocaleString()} minutes. Listing prices are asking prices, not guaranteed proceeds. Shop stock and sale waiting time are not supplied by these price endpoints.</p><button className="nu-btn" disabled={saving} onClick={()=>void save()}>{saving?'Saving…':'Save this estimate'}</button></>:!busy&&<p>Profit remains unavailable until buy price, market price, travel cost and a valid trip time are known.{method==='Business'&&cost===null?' Enter the total business ticket budget under Travel costs and timing.':''}</p>}
  </article>}
  {chosen&&<article className="card"><h3>Compare destinations for {chosen.name}</h3>
   <p>Uses your {quantity}-item purchase, {method} travel, {fee}% selling fee and {waiting} minutes waiting. Each route uses its estimated cost and round-trip time. Overrides apply only to the selected trip above.</p>
   <div className="table-scroll"><table><caption>Destination estimates using the same observed resale price. Foreign stock comes from timestamped community reports.</caption><thead><tr><th>Country</th><th>Buy price</th><th>Price observed / source</th><th>Stock</th><th>Round trip</th><th>Trip profit</th><th>Profit / minute</th><th>Choose</th></tr></thead><tbody>
    {ROUTES.map(route=>{
     const observed=report(route.country);
     const recent=observed&&Date.now()-Date.parse(observed.observed_at)<300000;
     const purchase=recent?{buy_price:observed.cost,observed_on:observed.observed_at,source:stock.data!.source}:shopQuote(chosen,route.country);
     if(!purchase)return null;
     const duration=flightEstimate(route.country,method,travelRow?.payload,book).minutes;
     const estimate=recent&&observed.quantity<quantity?null:travelProfit({buy:purchase.buy_price,sell,quantity,cost:tripCost(route.country,method,paidLegs,businessPrice),roundTripMinutes:duration===null?null:duration*2,waitMinutes:waiting,feePercent:fee});
     return <tr key={route.country}><th scope="row">{route.country}</th><td>{money(purchase.buy_price)}</td><td>{purchase.observed_on??(current?new Date(current.detail.fetched_at).toLocaleString():'Collection time unavailable')} · {purchase.source??'Torn item catalogue'}</td><td>{observed?<>{observed.quantity.toLocaleString()} · {recent?'recent report':'older report'}<br/>{new Date(observed.observed_at).toLocaleString()}</>:'Unknown'}</td><td>{duration===null?'Unknown':duration*2+' min'}</td><td>{money(estimate?.profit??null)}</td><td>{money(estimate?estimate.perHour/60:null)}</td><td><button className="nu-btn" onClick={()=>{setCountry(route.country);setCategory('');setCostOverride('');setTimeOverride('');}}>Plan {route.country}</button></td></tr>;
    })}
   </tbody></table></div>
   {!sell&&<p>Refresh item prices to calculate profit across destinations.</p>}
   <DataFreshness at={current?.market.fetched_at} source="Torn item market · observed asking price" busy={busy} error={!!error}/>
  </article>}
  {saveMessage&&<p role="status">{saveMessage}</p>}
  {!!saved.length&&<details className="card"><summary>Saved estimates ({saved.length})</summary><div className="table-scroll"><table><thead><tr><th>Location</th><th>Item</th><th>Profit</th><th>Profit / hour</th></tr></thead><tbody>{saved.map(s=><tr key={s.id}><td>{s.destination}</td><td>{s.item_name}</td><td>{money(s.profit_total)}</td><td>{money(s.profit_per_hour)}</td></tr>)}</tbody></table></div><p>Saved estimates use the prices and assumptions from when they were saved.</p></details>}
 </section>;
}
