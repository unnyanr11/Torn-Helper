import {useEffect,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {supabase} from '../lib/supabase';
import {stockChoices,stockLabel} from '../lib/stock-catalogue';
import {type PricePoint,stockDecision} from '../lib/stock-forecast';
import {scoreForwardPredictions,type MinuteForecast,type MinuteHorizon} from '../lib/minute-forecast';
import {downloadBlob} from '../lib/export';
import {ForecastDetails} from './StockForecast';
import SelectEntry from './SelectEntry';
type Status={last_attempt:string|null;last_success:string|null;provider_at:string|null;rows_written:number;message:string;backfilled_stocks:number};
type Prediction={targetTime:number;predictedPrice:number;originPrice:number};
export default function MinuteStockLab(){
 const [selected,setSelected]=useState('2'),[horizon,setHorizon]=useState<MinuteHorizon>(1),[forecast,setForecast]=useState<MinuteForecast>(),[training,setTraining]=useState(false),[problem,setProblem]=useState(''),[now,setNow]=useState(()=>Date.now()/1000);
 const predictions=useRef(new Map<string,Prediction[]>());
 const status=useQuery({queryKey:['stock-minute-status'],staleTime:10000,refetchInterval:20000,retry:1,queryFn:async()=>{const r=await supabase.from('stock_collection_status').select('last_attempt,last_success,provider_at,rows_written,message,backfilled_stocks').eq('id',1).single();if(r.error)throw r.error;return r.data as Status;}});
 const history=useQuery({queryKey:['stock-minute-history',selected,status.data?.provider_at,status.data?.backfilled_stocks],enabled:status.isSuccess,staleTime:Infinity,gcTime:60000,retry:1,queryFn:async()=>{
  const r=await supabase.rpc('read_stock_minute_history',{p_stock_id:Number(selected)});if(r.error)throw r.error;
  return (Array.isArray(r.data)?r.data:[]).filter((p:PricePoint)=>Number.isInteger(p.timestamp)&&Number.isFinite(p.price)&&p.price>0) as PricePoint[];
 }});
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()/1000),10000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{
  setForecast(undefined);setProblem('');
  if(!history.data){setTraining(false);return;}
  setTraining(true);let worker:Worker;
  try{
   worker=new Worker(new URL('../workers/minute-forecast.worker.ts',import.meta.url),{type:'module'});
   worker.onmessage=event=>{
    setTraining(false);
    if(event.data.error){setProblem(event.data.error);return;}
    const result=event.data.forecast as MinuteForecast;setForecast(result);
    const currentNow=Date.now()/1000;
    if(!result.issue&&result.last&&result.targetTime>currentNow){
     const log=predictions.current.get(`${selected}:${horizon}`)??[];
     if(!log.some(p=>p.targetTime===result.targetTime)){log.push({targetTime:result.targetTime,predictedPrice:result.predictedPrice,originPrice:result.last.price});predictions.current.set(`${selected}:${horizon}`,log.slice(-240));}
    }
   };
   worker.onerror=()=>{setTraining(false);setProblem('Model training failed. Refresh minute history to retry.');};
   worker.postMessage({points:history.data,now:Date.now()/1000,horizon});
   return()=>worker.terminate();
  }catch{setTraining(false);setProblem('Background model training is unavailable in this browser.');}
 },[history.data,selected,horizon]);
 const live=scoreForwardPredictions(predictions.current.get(`${selected}:${horizon}`)??[],history.data??[]);
 const stale=!status.data?.provider_at||now-Date.parse(status.data.provider_at)/1000>120;
 function exportCsv(){
  const quote=(value:string|number)=>`"${String(value).replace(/"/g,'""')}"`;
  const rows=[['Stock','Observed at (UTC)','Price','Source'],...(history.data??[]).map(p=>[stockLabel(selected),new Date(p.timestamp*1000).toISOString(),p.price,'Tornsy'])];
  downloadBlob(new Blob([rows.map(row=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),`stock-${selected}-minute-history.csv`);
 }
 return <section className="card stock-forecast" aria-labelledby="minute-stock-title">
  <span className="badge">Shared minute history · experimental ML</span><h3 id="minute-stock-title">Minute-by-minute stock lab</h3>
  <p>All 35 stocks are collected in the background every minute. New observations retrain this stock’s model while you watch. Accuracy is measured, not guaranteed to improve each minute.</p>
  <p className="muted">Source: <a href="https://tornsy.com/api" target="_blank" rel="noreferrer">Tornsy’s public Torn price feed</a>. No player API key is shared. We retain 30 days online and never fill missing minutes with invented prices.</p>
  <div className="stock-forecast-controls"><SelectEntry label="Minute stock" searchable allowCustom={false} value={selected} options={stockChoices()} onChange={e=>setSelected(e.target.value)}/><label>Forecast ahead<select className="nu-input" value={horizon} onChange={e=>setHorizon(Number(e.target.value) as MinuteHorizon)}>{[1,5,15,60].map(n=><option key={n} value={n}>{n} minute{n>1?'s':''}</option>)}</select></label><button className="nu-btn" type="button" disabled={status.isFetching||history.isFetching} onClick={()=>{void status.refetch();void history.refetch();}}>Refresh minute data</button></div>
  {status.isError||history.isError?<p role="alert">Minute history could not load. Existing official-chart analysis remains available below.</p>:<p role="status">{status.data?.message??'Loading collector status…'} · Historical warmup: {status.data?.backfilled_stocks??0}/35 stocks · {status.data?.provider_at?`Last source minute: ${new Date(status.data.provider_at).toLocaleString()}`:'Waiting for the first provider batch.'}{stale?' · Data is stale or not ready.':''}</p>}
  {training&&<p role="status">Testing models against earlier minutes…</p>}{problem&&<p role="alert">{problem}</p>}
  {forecast&&<><p>Selected model: <strong>{forecast.model}</strong> · {forecast.tuningTests} earlier tuning tests · {forecast.tests} separate walk-forward holdout tests.</p>
   <ForecastDetails forecast={stale?{...forecast,issue:'Minute prices are stale. Wait for a fresh collection.'}:forecast} id={Number(selected)} now={now}/>
   {!forecast.issue&&<p>Held-out error improvement over no change: {(forecast.holdoutImprovement*100).toFixed(1)}%. Historical interval coverage: {(forecast.intervalCoverage*100).toFixed(0)}% on {Math.max(0,forecast.tests-19-horizon)} sequential checks; this is not a promised future probability. Missing intervals in the loaded history: {forecast.gapCount}. Only the latest consecutive segment is trained.</p>}
  </>}
  <p>Forward score during this open page session: {live.tests} completed forward predictions{live.tests&&live.directionAccuracy!==null?` · ${(live.directionAccuracy*100).toFixed(0)}% direction correct · return MAE ${((live.mae??0)*100).toFixed(4)}% vs no-change ${((live.baselineMae??0)*100).toFixed(4)}%`:''}. This is separate from historical tests and resets on reload.</p>
  {forecast&&!forecast.issue&&stockDecision(forecast,now).signal==='Wait'&&<p>The model currently says Wait. A short-term movement often does not cover the sale fee and historical prediction error.</p>}
  <details><summary>Online minute price table and spreadsheet export ({history.data?.length??0} loaded)</summary><p>Most recent 2,000 recorded minutes for this stock. This is a bounded view of the 30-day database archive. CSV opens in Excel or can be imported into Google Sheets.</p><button className="nu-btn" type="button" disabled={!history.data?.length} onClick={exportCsv}>Download loaded minute prices (CSV)</button>
   <div className="stock-forecast-table"><table><thead><tr><th>Source minute</th><th>Price</th><th>Source</th></tr></thead><tbody>{[...(history.data??[])].reverse().slice(0,120).map(p=><tr key={p.timestamp}><td>{new Date(p.timestamp*1000).toLocaleString()}</td><td>${p.price.toFixed(2)}</td><td>Tornsy</td></tr>)}</tbody></table></div><p>Showing the latest 120 rows; CSV contains all loaded rows.</p>
  </details>
  <details><summary>How the minute model is tested</summary><p>Momentum, mean reversion, ridge regression, and a no-change baseline compete on an earlier tuning window. The winner is then tested on a separate later window using only prices known at each prediction. A final fit uses the latest data to estimate the chosen future interval. Overlapping future labels are excluded from training. Calculations run in a background worker to keep the interface responsive.</p><p>Features cover 1–60 minute returns, volatility and distance from recent averages. No trade signal is shown unless the held-out model beats no change by 5%, gets at least 55% of directions right, and clears the 0.1% selling fee plus the historical error range. Dividends, slippage and benefit blocks are excluded. All trades remain manual.</p></details>
 </section>;
}
