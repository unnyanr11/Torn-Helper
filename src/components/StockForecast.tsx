import {useEffect,useMemo,useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useCurrentObservations} from '../hooks/useSavedObservations';
import {stockChoices,stockLabel} from '../lib/stock-catalogue';
import {stockHistory,forecastStock,stockDecision,HISTORY_ENDPOINT,type StockForecast as Forecast} from '../lib/stock-forecast';
import {scanStockHistory,stockScanPause} from '../lib/stock-scan';
import {invokeTornData} from '../lib/torn-data-client';
import {functionError} from '../lib/function-error';
import {observationsKey} from '../lib/observation-cache';
import {observationKey} from '../lib/personal-data';
import type {DataEntry} from '../lib/connected-data';
import SelectEntry from './SelectEntry';
import './stock-forecast.css';
const money=(value:number)=>value.toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:2});
const percent=(value:number)=>`${value>=0?'+':''}${(value*100).toFixed(2)}%`;
export const intervalLabel=(seconds:number)=>seconds>=86400?`${+(seconds/86400).toFixed(1)} days`:seconds>=3600?`${+(seconds/3600).toFixed(1)} hours`:`${+(seconds/60).toFixed(1)} minutes`;
export default function StockForecast(){
 const saved=useCurrentObservations(),client=useQueryClient();
 const [selected,setSelected]=useState('2'),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState('');
 const [now,setNow]=useState(()=>Date.now()/1000),controller=useRef<AbortController|null>(null);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()/1000),30000);return ()=>clearInterval(timer);},[]);
 useEffect(()=>{setBusy(false);setProgress('');setError('');return ()=>{controller.current?.abort();controller.current=null;};},[saved.owner]);
 const choices=stockChoices();
 const forecasts=useMemo(()=>{
  const result=new Map<number,Forecast>();
  const observations=Object.values(saved.data??{}).flatMap(e=>e.observation?[e.observation]:[]).filter(o=>o.endpoint_id===HISTORY_ENDPOINT).sort((a,b)=>Date.parse(a.fetched_at)-Date.parse(b.fetched_at));
  for(const observation of observations){const id=Number(observation.parameters.stockId);if(choices.some(c=>Number(c.value)===id))result.set(id,forecastStock(stockHistory(observation.payload,id)));}
  return result;
 },[saved.data]);
 const selectedForecast=forecasts.get(Number(selected));
 async function scan(all:boolean){
  if(controller.current||!saved.owner)return;
  const current=new AbortController();controller.current=current;setBusy(true);setError('');setProgress('Loading chart history…');
  try{
   const ids=all?choices.map(c=>Number(c.value)):[Number(selected)];
   const result=await scanStockHistory({ids,signal:current.signal,force:!all,
    saved:id=>client.getQueryData<Record<string,DataEntry>>(observationsKey(saved.owner!))?.[observationKey(HISTORY_ENDPOINT,{stockId:String(id)})]?.observation,
    fetch:async(id,signal)=>{
     const response=await invokeTornData(client,{body:{endpoint_id:HISTORY_ENDPOINT,parameters:{stockId:String(id)},refresh:!all},signal});
     if(response.error||response.data?.error)throw await functionError(response.data,response.error,'Unable to load stock history.');
     if(response.data?.endpoint_id!==HISTORY_ENDPOINT)throw new Error('Stock history was not returned.');
     return response.data;
    },pause:stockScanPause,progress:(done,total)=>{if(!current.signal.aborted)setProgress(`Analysed ${done} of ${total} stocks.`);}
   });
   if(!current.signal.aborted){setNow(Date.now()/1000);setProgress(`Analysis complete · ${result.done} stocks checked.`);}
  }catch(failure){if(!current.signal.aborted){setError(failure instanceof Error?failure.message:'Unable to analyse stocks.');setProgress('Scan stopped. Successfully loaded charts are kept; no automatic retry.');}}
  finally{if(controller.current===current){controller.current=null;setBusy(false);}}
 }
 function stop(){controller.current?.abort();controller.current=null;setBusy(false);setProgress('Scan stopped. Loaded charts are kept.');}
 const ranked=[...forecasts].sort((a,b)=>{
  const da=stockDecision(a[1],now),db=stockDecision(b[1],now);
  const priority=(signal:string)=>signal==='Buy candidate'?0:signal==='Sell / rebuy watch'?1:2;
  return priority(da.signal)-priority(db.signal)||a[0]-b[0];
 });
 return <section className="card stock-forecast" aria-labelledby="stock-forecast-title">
  <div className="stock-forecast-heading"><div><span className="badge">Experimental ML</span><h3 id="stock-forecast-title">Stock timing lab</h3><p>Find buy candidates and sell / rebuy opportunities from actual Torn chart history.</p></div><a className="nu-btn" href="https://www.torn.com/page.php?sid=stocks" target="_blank" rel="noreferrer">Open Torn market ↗</a></div>
  <div className="stock-forecast-controls"><SelectEntry label="Stock to analyse" value={selected} options={choices} onChange={e=>setSelected(e.target.value)} allowCustom={false} searchable disabled={busy}/><div><button className="nu-btn" disabled={busy||!saved.owner||!selected} onClick={()=>void scan(false)}>Analyse / refresh selected</button>{' '}<button className="nu-btn" disabled={busy||!saved.owner} onClick={()=>void scan(true)}>Compare all 35 stocks</button>{busy&&<button className="nu-btn" onClick={stop}>Stop scan</button>}</div></div>
  <p className="muted">Charts load only when requested. Comparison reuses charts saved in the last 15 minutes. Training runs on your device; no extra calls while watching the results.</p>
  {progress&&<p role="status">{progress}</p>}{error&&<p role="alert">{error}</p>}
  {selectedForecast?<ForecastDetails forecast={selectedForecast} id={Number(selected)} now={now}/>:<div className="nu-inset stock-forecast-empty"><h4>No forecast yet</h4><p>Choose a stock and load its chart. A price quote alone cannot train this model.</p></div>}
  {ranked.length>0&&<div className="stock-forecast-table"><table><caption>Comparison · {ranked.length} of 35 stocks analysed. Buy candidates appear first; compare forecasts with the same time interval.</caption><thead><tr><th>Stock</th><th>Signal</th><th>Forecast interval</th><th>Estimated return after sale fee</th><th>Historical directional accuracy</th><th>Details</th></tr></thead><tbody>{ranked.map(([id,forecast])=>{
   const decision=stockDecision(forecast,now);
   return <tr key={id}><th scope="row">{stockLabel(id)}</th><td>{decision.signal}{decision.stale&&!forecast.issue?' · stale':''}</td><td>{forecast.issue?'—':intervalLabel(forecast.cadence)}</td><td>{forecast.issue?'—':percent(decision.netReturn)}</td><td>{forecast.tests?`${Math.round(forecast.directionAccuracy*100)}% · ${forecast.tests} tests`:'Needs history'}</td><td><button className="nu-btn" onClick={()=>setSelected(String(id))}>View {stockLabel(id)}</button></td></tr>;
  })}</tbody></table></div>}
  <details className="stock-forecast-method"><summary>How the model earns a signal</summary><p>A regularized regression learns from recent returns, momentum, volatility, and distance from the recent average. It needs at least 80 evenly spaced observations. Each historical test trains only on earlier prices. A signal needs at least 20 tests, 55% directional accuracy, and at least 5% less prediction error than assuming no price change.</p><p>The displayed range uses the 90th percentile of historical prediction errors. It is an empirical error range, not a 90% guarantee. Stale data, weak tests, or a move too small to clear the range and sale fee produce Wait. The forecast covers one chart interval, not an exact market bottom or top.</p><p>Price-only estimates exclude dividends and lost benefit progress. Use trading shares; preserve benefit blocks you want to keep. Losses remain possible. Trades are placed manually in Torn.</p><a href="https://wiki.torn.com/wiki/Stock_Market" target="_blank" rel="noreferrer">Torn stock rules · 0.1% sale fee, no buy fee</a></details>
 </section>;
}
export function ForecastDetails({forecast,id,now}:{forecast:Forecast;id:number;now:number}){
 const decision=stockDecision(forecast,now);
 return <article className="nu-inset stock-forecast-detail"><h4>{stockLabel(id)}</h4><span className={`badge ${decision.signal==='Buy candidate'?'ok':decision.signal==='Sell / rebuy watch'?'warn':''}`}>{decision.signal}</span><p>{decision.reason}</p>
  {!forecast.issue&&<><div className="stock-forecast-metrics"><div><small>Last chart price</small><strong>{money(forecast.last!.price)}</strong><small>{new Date(forecast.last!.timestamp*1000).toLocaleString()}</small></div><div><small>Next {intervalLabel(forecast.cadence)}</small><strong>{money(forecast.predictedPrice)}</strong><small>Window ends {new Date(forecast.targetTime*1000).toLocaleString()}</small></div><div><small>Historical error range</small><strong>{money(forecast.lower)} – {money(forecast.upper)}</strong><small>Estimated return after sale fee: {percent(decision.netReturn)}</small></div><div><small>Model evidence</small><strong>{forecast.supported?'Passed historical checks':'Weak · wait'}</strong><small>{forecast.tests} walk-forward tests · {Math.round(forecast.directionAccuracy*100)}% directional accuracy</small></div></div>
   <ForecastChart forecast={forecast}/>
   {decision.signal==='Buy candidate'&&<p>Entry ceiling for this forecast: <strong>{money(decision.buyCeiling)}</strong> per share. Above that price, the lower estimate no longer covers the sale fee. Refresh before trading.</p>}
   {decision.signal==='Sell / rebuy watch'&&<p>Selling at the observed price leaves {money(decision.rebuyCeiling)} per share after the fee. A rebuy must cost less to increase your share count. Estimated next price: {money(forecast.predictedPrice)}. This is a watch signal, not a promised rebuy price.</p>}
   <p className="muted">Model mean absolute error: {(forecast.mae*100).toFixed(3)}% · No-change baseline: {(forecast.baselineMae*100).toFixed(3)}% per interval. Refresh prices before acting.</p>
  </>}
 </article>;
}
function ForecastChart({forecast}:{forecast:Forecast}){
 const points=forecast.points.slice(-60),min=Math.min(...points.map(p=>p.price),forecast.lower),max=Math.max(...points.map(p=>p.price),forecast.upper),span=max-min||1;
 const y=(price:number)=>165-(price-min)/span*140,x=(i:number)=>20+i/(points.length)*560;
 const path=points.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(p.price).toFixed(2)}`).join(' ');
 const last=points[points.length-1];
 return <figure><svg viewBox="0 0 600 190" role="img" aria-label="Observed stock prices and next-interval estimate with historical error range"><path d={path} fill="none" stroke="var(--accent)" strokeWidth="2"/><path d={`M${x(points.length-1)},${y(last.price)} L580,${y(forecast.predictedPrice)}`} stroke="currentColor" strokeDasharray="4 4" fill="none"/><path d={`M580,${y(forecast.lower)} V${y(forecast.upper)}`} stroke="currentColor" strokeWidth="8" opacity=".3"/><circle cx="580" cy={y(forecast.predictedPrice)} r="4" fill="currentColor"/></svg><figcaption>Solid: observed history · Dashed: model estimate · Vertical band: historical error range</figcaption></figure>;
}
