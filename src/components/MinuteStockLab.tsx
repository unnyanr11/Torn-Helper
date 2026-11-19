import {useStockChartHistory} from '../hooks/useStockChartHistory';
import StockPriceChart from './StockPriceChart';
import StockAdvice from './StockAdvice';
import {useStockStream} from '../hooks/useStockStream';
import {useStockAnalyses} from '../hooks/useStockAnalyses';
import StockHistoryExport from './StockHistoryExport';
import LiveStockPrices from './LiveStockPrices';
import {useEffect,useRef,useState} from 'react';
import {stockChoices,stockLabel} from '../lib/stock-catalogue';
import {scoreForwardPredictions,type MinuteHorizon} from '../lib/minute-forecast';
import {ForecastDetails} from './StockForecast';
import SelectEntry from './SelectEntry';
type Prediction={targetTime:number;predictedPrice:number;originPrice:number};
export default function MinuteStockLab(){
 const [selected,setSelected]=useState('2'),[horizon,setHorizon]=useState<MinuteHorizon>(1),[archiveOpen,setArchiveOpen]=useState(false),[now,setNow]=useState(()=>Date.now()/1000);
 const predictions=useRef(new Map<string,Prediction[]>());
 const {status,connected}=useStockStream(),analysis=useStockAnalyses();
 const chart=useStockChartHistory(Number(selected),status.data?.provider_at);
 const rows=(analysis.data??[]).filter(row=>row.horizon===horizon);
 const analyses=Object.fromEntries(rows.map(row=>[String(row.stock_id),row.forecast]));
 const chosen=rows.find(row=>row.stock_id===Number(selected)),forecast=chosen?.forecast;
 const actionableForecast=forecast?.issue||forecast?.last?.timestamp===Date.parse(status.data?.provider_at??'')/1000?forecast:forecast?{...forecast,issue:'Newer prices are available. This saved analysis is being updated; wait before trading.'}:undefined;
 const stale=!status.data?.provider_at||now-Date.parse(status.data.provider_at)/1000>120;
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()/1000),10000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{
  for(const row of analysis.data??[]){
   const result=row.forecast;
   if(result.issue||!result.last||result.targetTime<=Date.now()/1000)continue;
   const key=`${row.stock_id}:${row.horizon}`,log=predictions.current.get(key)??[];
   if(!log.some(p=>p.targetTime===result.targetTime)){log.push({targetTime:result.targetTime,predictedPrice:result.predictedPrice,originPrice:result.last.price});predictions.current.set(key,log.slice(-240));}
  }
 },[analysis.data]);
 const live=scoreForwardPredictions(predictions.current.get(`${selected}:${horizon}`)??[],forecast?.points??[]);
 const currentCount=rows.filter(row=>Date.parse(row.provider_at)===Date.parse(status.data?.provider_at??'')).length;
 return <section className="card stock-forecast" aria-labelledby="minute-stock-title">
  <span className="badge">Shared server analysis · experimental ML</span><h3 id="minute-stock-title">Minute-by-minute stock lab</h3>
  <p>All 35 stocks are collected and analysed in the backend every minute. The latest saved results load when you open this screen. Accuracy is measured, not guaranteed.</p>
  <p className="muted">Prices use the shared backend key; <a href="https://tornsy.com/api" target="_blank" rel="noreferrer">Tornsy</a> supplies historical backfill and fallback prices. We retain 30 days online and train on the latest seven days.</p>
  <div className="stock-forecast-controls">
   <SelectEntry label="Minute stock" searchable allowCustom={false} value={selected} options={stockChoices()} onChange={e=>setSelected(e.target.value)}/>
   <label>Forecast ahead<select className="nu-input" value={horizon} onChange={e=>setHorizon(Number(e.target.value) as MinuteHorizon)}>{[1,5,15,60].map(n=><option key={n} value={n}>{n} minute{n>1?'s':''}</option>)}</select></label>
   <button className="nu-btn" type="button" disabled={analysis.isFetching} onClick={()=>void analysis.refetch()}>Check latest results</button>
  </div>
  <h4>Suggested action for {stockLabel(selected)} · next {horizon} minute{horizon>1?'s':''}</h4>
  <StockAdvice forecast={actionableForecast} now={now} training={!forecast&&analysis.isFetching}/>
  {analysis.isPending&&<p role="status">Loading saved server analysis…</p>}
  {analysis.isError&&<p role="alert">Saved analysis could not be refreshed. Previous results remain visible. <button className="nu-btn" onClick={()=>void analysis.refetch()}>Retry</button></p>}
  {chosen&&<p className="muted">Analysed on the server at {new Date(chosen.computed_at).toLocaleTimeString()} · {(chosen.processing_ms/1000).toFixed(3)} seconds of model processing.</p>}
  {(forecast||chart.data?.points.length)&&<StockPriceChart key={selected} forecast={forecast??{points:chart.data!.points,last:chart.data!.points.at(-1)!,issue:'Analysis unavailable',cadence:60,predictedPrice:0,predictedReturn:0,lower:0,upper:0,tests:0,mae:0,baselineMae:0,directionAccuracy:0,supported:false,targetTime:0,validation:[]}} name={stockLabel(selected)} history={chart.data?.points} now={now}/>}
  {chart.isPending&&<p role="status">Loading the latest recorded week of prices independently of model analysis…</p>}
  {chart.isError&&<p role="alert">Latest chart prices could not be refreshed. The displayed timestamps show the age of retained data. <button className="nu-btn" onClick={()=>void chart.refetch()}>Retry chart</button></p>}
  <LiveStockPrices at={status.data?.provider_at} connected={connected} onSelect={setSelected} analyses={analyses} now={now}/>
  <p role="status">{currentCount}/35 stocks have saved analysis for the latest price minute.{currentCount<35?' The backend is updating results; earlier data stays visible.':''}{stale?' Price collection is stale; wait for fresh data.':''}</p>
  {forecast&&<details><summary>Model evidence and price chart</summary>
   <p>Weekly data coverage: {(forecast.observations/10080*100).toFixed(1)}% ({forecast.observations.toLocaleString()}/10,080 recorded minutes). Valid weekly training samples: {forecast.trainingSamples.toLocaleString()}.</p>
   <p>Training window: {chosen?.history_from?new Date(chosen.history_from).toLocaleString():'Unavailable'} to {chosen?.history_to?new Date(chosen.history_to).toLocaleString():'Unavailable'}. The chart shows the latest 60 observations.</p>
   <p>Selected model: <strong>{forecast.model}</strong> · {forecast.tuningTests} earlier tuning tests · {forecast.tests} separate walk-forward holdout tests.</p>
   <ForecastDetails hideChart forecast={stale?{...forecast,issue:'Minute prices are stale. Wait for fresh data.'}:forecast} id={Number(selected)} now={now}/>
   <p>Held-out error improvement over no change: {(forecast.holdoutImprovement*100).toFixed(1)}%. Historical interval coverage: {(forecast.intervalCoverage*100).toFixed(0)}% on {forecast.coverageTests} sequential checks. Missing intervals: {forecast.gapCount}.</p>
  </details>}
  <p>Forward score during this open page session: {live.tests} completed predictions{live.tests&&live.directionAccuracy!==null?` · ${(live.directionAccuracy*100).toFixed(0)}% direction correct`:''}. This score uses subsequent observed prices and resets on reload.</p>
  <details onToggle={e=>setArchiveOpen(e.currentTarget.open)}><summary>Online minute price table and spreadsheet export</summary>
   <p>The optional archive contains the last seven days of recorded minutes. CSV opens in Excel or Google Sheets.</p>
   {archiveOpen&&<StockHistoryExport selected={selected} providerAt={status.data?.provider_at} backfilled={status.data?.backfilled_stocks}/>}
  </details>
  <details><summary>How the minute model is tested</summary><p>Momentum, mean reversion, ridge regression and a no-change baseline compete on an earlier tuning window. The winner is tested on a separate later window using only prices known at prediction time. The backend saves results for all four forecast horizons. Missing prices are never invented.</p><p>A signal requires at least 55% held-out directional accuracy, 5% less error than no change, and an estimated move exceeding the 0.1% selling fee and historical error margin. Preserve benefit blocks and place trades manually in Torn.</p></details>
 </section>;
}
