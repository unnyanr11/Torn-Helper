import {useLongTermStocks,useLongTermChart} from '../hooks/useLongTermStocks';
import {longTermStockDecision,type TradingMode} from '../lib/long-term-stock';
import {useStockInferenceStatus} from '../hooks/useStockInferenceStatus';
import {fillMissingStockMinutes} from '../lib/stock-minute-clean';
import type {StockHolding} from '../lib/stock-trade-decision';
import {useStockChartHistory} from '../hooks/useStockChartHistory';
import StockPriceChart from './StockPriceChart';
import StockAdvice from './StockAdvice';
import {useStockStream} from '../hooks/useStockStream';
import {useStockAnalyses} from '../hooks/useStockAnalyses';
import StockHistoryExport from './StockHistoryExport';
import LiveStockPrices,{type StockLiveQuote} from './LiveStockPrices';
import {useEffect,useMemo,useState} from 'react';
import {stockChoices,stockLabel} from '../lib/stock-catalogue';
import {type MinuteHorizon} from '../lib/minute-forecast';
import {ForecastDetails} from './StockForecast';
import SelectEntry from './SelectEntry';
export default function MinuteStockLab({holdings=[]}:{holdings?:StockHolding[]}){
 const [liveQuotes,setLiveQuotes]=useState<StockLiveQuote[]>([]);
 const [mode,setMode]=useState<TradingMode>('short');
 const [comparisonMinutes,setComparisonMinutes]=useState(1440);
 const [selected,setSelected]=useState('2'),[horizon,setHorizon]=useState<MinuteHorizon>(1),[archiveOpen,setArchiveOpen]=useState(false),[now,setNow]=useState(()=>Date.now()/1000);
 const {status,connected}=useStockStream(),analysis=useStockAnalyses();
 const longAnalysis=useLongTermStocks(mode==='long',status.data?.provider_at);
 const longChosen=longAnalysis.data?.find(row=>row.stock_id===Number(selected));
 const longChart=useLongTermChart(Number(selected),mode==='long',longChosen?.computed_at);
 const timing=useStockInferenceStatus();
 const chart=useStockChartHistory(Number(selected),status.data?.provider_at);
 const cleanChart=useMemo(()=>chart.data?.points?fillMissingStockMinutes(chart.data.points):undefined,[chart.data]);
 const currentQuote=liveQuotes.find(q=>q.stock_id===Number(selected));
 const holding=holdings.find(h=>Number(h.stock_id)===Number(selected));
 const rows=(analysis.data??[]).filter(row=>row.horizon===horizon);
 const analyses=Object.fromEntries(rows.map(row=>[String(row.stock_id),row.forecast]));
 const chosen=rows.find(row=>row.stock_id===Number(selected)),forecast=chosen?.forecast;
 const actionableForecast=forecast?.issue||forecast?.last?.timestamp===Date.parse(status.data?.provider_at??'')/1000?forecast:forecast?{...forecast,issue:'Newer prices are available. This saved analysis is being updated; wait before trading.'}:undefined;
 const stale=!status.data?.provider_at||now-Date.parse(status.data.provider_at)/1000>120;
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()/1000),10000);return()=>clearInterval(timer);},[]);
 const currentCount=rows.filter(row=>Date.parse(row.provider_at)===Date.parse(status.data?.provider_at??'')).length;
 return <section className="card stock-forecast" aria-labelledby="minute-stock-title">
  <span className="badge">Shared server analysis · experimental ML</span><h3 id="minute-stock-title">Stock trading lab</h3>
  <p>Short-term predictions update for all 35 stocks every minute, with weekly models refitted every 15 minutes. Long-term predictions update together every five minutes. The latest saved results load when you open this screen. Accuracy is measured, not guaranteed.</p>
  <p className="muted">Prices use the shared backend key; <a href="https://tornsy.com/api" target="_blank" rel="noreferrer">Tornsy</a> supplies historical backfill and fallback prices. We retain 30 days online. Short-term models use seven days; long-term models use up to 30 days.</p>
  <div className="stock-forecast-controls">
   <label>Trading style<select className="nu-input" aria-label="Trading style" value={mode} onChange={e=>{setMode(e.target.value as TradingMode);setComparisonMinutes(1440);}}><option value="short">Short-term trading</option><option value="long">Long-term trading</option></select></label>
   <SelectEntry label="Stock" searchable allowCustom={false} value={selected} options={stockChoices()} onChange={e=>setSelected(e.target.value)}/>
   {mode==='short'&&<label>Forecast ahead<select className="nu-input" value={horizon} onChange={e=>setHorizon(Number(e.target.value) as MinuteHorizon)}>{[1,5,15,60].map(n=><option key={n} value={n}>{n} minute{n>1?'s':''}</option>)}</select></label>}
   <button className="nu-btn" type="button" disabled={mode==='long'?longAnalysis.isFetching:analysis.isFetching} onClick={()=>void (mode==='long'?longAnalysis.refetch():analysis.refetch())}>Check latest results</button>
  </div>
  {mode==='short'?<>
  <p className="muted">Buy/Wait uses the shared seven-day stock history and saved backend model, including prices collected before you signed in. Collection continues while you are logged out; opening your profile does not start a new training window.</p>
  <p className="muted">Sell uses your recorded holdings and average purchase cost below. Keep them up to date; unknown cost or zero shares cannot produce Sell.</p>
  {timing.data?.duration_ms!=null&&<p role="status">Latest complete backend batch: {timing.data.stock_count} stocks · {timing.data.forecast_count} forecasts in {(timing.data.duration_ms/1000).toFixed(3)} seconds · {timing.data.within_budget?'under the 10-second target':'over the 10-second target'}. Observed price minute: {new Date(timing.data.provider_at).toLocaleString()}.</p>}
  <h4>Suggested action for {stockLabel(selected)} · next {horizon} minute{horizon>1?'s':''}</h4>
  <StockAdvice holding={holding} forecast={actionableForecast} now={now} training={!forecast&&analysis.isFetching}/>
  {analysis.isPending&&<p role="status">Loading saved server analysis…</p>}
  {analysis.isError&&<p role="alert">Saved analysis could not be refreshed. Previous results remain visible. <button className="nu-btn" onClick={()=>void analysis.refetch()}>Retry</button></p>}
  {forecast&&<p className="muted">Historical model evidence: {forecast.tests} held-out checks · {(forecast.directionAccuracy*100).toFixed(1)}% direction correct. This evidence comes from the stored market history and is shared across users.</p>}
  {chosen&&<p className="muted">Analysed on the server at {new Date(chosen.computed_at).toLocaleTimeString()} · {(chosen.processing_ms/1000).toFixed(3)} seconds of model processing.</p>}
  {forecast?.fitted&&<p className="muted">Weekly model last trained: {new Date(forecast.fitted.trainedAt*1000).toLocaleString()}. Historical validation belongs to that fit; each minute updates the prediction with fresh prices.</p>}
  </>:<>
   <p>Long-term mode compares the last 24 hours, seven days and up to 30 days of hourly closing prices, with a forecast for the next 24 hours. The chart uses hourly closes; card highs and lows include every recorded minute. Models run together on the backend every five minutes; opening this screen only reads saved results.</p>
   <p>Hold and Sell require positive recorded shares. Sell also requires a known purchase cost and strictly more than 0.1% net profit after the selling fee. Incomplete or unvalidated analysis shows Wait even when you own shares.</p>
   <h4>Suggested long-term action for {stockLabel(selected)}</h4>
   <StockAdvice now={now} holding={holding} decision={longTermStockDecision(currentQuote?longChosen?.forecast:undefined,now,holding,currentQuote?{timestamp:Date.parse(currentQuote.observed_at)/1000,price:currentQuote.price}:undefined)} />
   {longAnalysis.isPending&&<p role="status">Loading saved long-term analysis…</p>}
   {longAnalysis.isError&&<p role="alert">Long-term results could not be loaded. <button className="nu-btn" onClick={()=>void longAnalysis.refetch()}>Retry long-term results</button></p>}
   {longChosen&&<>
    <p>Available history: {longChosen.forecast.historyDays.toFixed(1)} / 30 days · {(longChosen.forecast.coverage*100).toFixed(1)}% recorded hourly coverage. {longChosen.forecast.historyDays<29.9?'A full month is not yet available. Missing days are not fabricated.':'Full 30-day comparison available.'}</p>
    <p>Price change: {([["24 hours",longChosen.forecast.change24h],["7 days",longChosen.forecast.change7d],["30 days",longChosen.forecast.change30d]] as const).map(([label,value])=>`${label}: ${value===null?'not enough history':`${value>=0?'+':''}${(value*100).toFixed(2)}%`}`).join(' · ')}</p>
    <p>Model: {longChosen.forecast.model} · {longChosen.forecast.tests} historical checks · {(longChosen.forecast.directionAccuracy*100).toFixed(1)}% direction correct. Checks use overlapping 24-hour outcomes, not independent trading trials.</p>
    <p>All-stock backend batch: {(longChosen.batch_ms/1000).toFixed(3)} seconds · updated {new Date(longChosen.computed_at).toLocaleString()}.</p>
   </>}
  </>}
  {mode==='short'&&(forecast||chart.data?.points.length)&&<StockPriceChart comparisonMinutes={comparisonMinutes} onComparisonChange={setComparisonMinutes} key={selected} forecast={forecast??{points:chart.data!.points,last:chart.data!.points.at(-1)!,issue:'Analysis unavailable',cadence:60,predictedPrice:0,predictedReturn:0,lower:0,upper:0,tests:0,mae:0,baselineMae:0,directionAccuracy:0,supported:false,targetTime:0,validation:[]}} name={stockLabel(selected)} history={cleanChart} now={now}/>}
  {mode==='short'&&chart.isPending&&<p role="status">Loading the latest recorded week of prices independently of model analysis…</p>}
  {mode==='short'&&chart.isError&&<p role="alert">Latest chart prices could not be refreshed. The displayed timestamps show the age of retained data. <button className="nu-btn" onClick={()=>void chart.refetch()}>Retry chart</button></p>}
  {mode==='long'&&longChosen&&longChart.data&&<StockPriceChart longTerm forecast={longChosen.forecast} history={longChart.data} name={stockLabel(selected)} comparisonMinutes={comparisonMinutes} onComparisonChange={setComparisonMinutes} now={now}/>}
  {mode==='long'&&longChosen&&longChart.isPending&&<p role="status">Loading the saved long-term chart…</p>}
  {mode==='long'&&longChart.isError&&<p role="alert">Long-term chart unavailable. <button className="nu-btn" onClick={()=>void longChart.refetch()}>Retry chart</button></p>}
  <LiveStockPrices onPrices={setLiveQuotes} mode={mode} longAnalyses={Object.fromEntries((longAnalysis.data??[]).map(row=>[row.stock_id,row.forecast]))} comparisonMinutes={comparisonMinutes} horizon={horizon} holdings={holdings} at={status.data?.provider_at} connected={connected} onSelect={setSelected} analyses={analyses} now={now}/>
  {mode==='short'&&<p role="status">{currentCount}/35 stocks have saved analysis for the latest price minute.{currentCount<35?' The backend is updating results; earlier data stays visible.':''}{stale?' Price collection is stale; wait for fresh data.':''}</p>}
  {mode==='short'&&forecast&&<details><summary>Model evidence and price chart</summary>
   <p>Weekly data coverage: {(forecast.observations/10080*100).toFixed(1)}% ({forecast.observations.toLocaleString()}/10,080 recorded minutes). Valid weekly training samples: {forecast.trainingSamples.toLocaleString()}.</p>
   <p>Training window: {chosen?.history_from?new Date(chosen.history_from).toLocaleString():'Unavailable'} to {chosen?.history_to?new Date(chosen.history_to).toLocaleString():'Unavailable'}. The chart shows the latest 60 observations.</p>
   <p>Selected model: <strong>{forecast.model}</strong> · {forecast.tuningTests} earlier tuning tests · {forecast.tests} separate walk-forward holdout tests.</p>
   <ForecastDetails holding={holding} hideChart forecast={stale?{...forecast,issue:'Minute prices are stale. Wait for fresh data.'}:forecast} id={Number(selected)} now={now}/>
   <p>Held-out error improvement over no change: {(forecast.holdoutImprovement*100).toFixed(1)}%. Historical interval coverage: {(forecast.intervalCoverage*100).toFixed(0)}% on {forecast.coverageTests} sequential checks. Missing intervals: {forecast.gapCount} · Estimated minutes filled: {forecast.imputedCount??0}.</p>
  </details>}

  <details onToggle={e=>setArchiveOpen(e.currentTarget.open)}><summary>Online minute price table and spreadsheet export</summary>
   <p>The optional archive contains the last seven days of recorded minutes. CSV opens in Excel or Google Sheets.</p>
   {archiveOpen&&<StockHistoryExport selected={selected} providerAt={status.data?.provider_at} backfilled={status.data?.backfilled_stocks}/>}
  </details>
  {mode==='long'&&<details><summary>How the long-term model is tested</summary><p>Hourly closes from up to 30 days are compared using 24-hour momentum, seven-day mean reversion, a blend and a no-change baseline. Each historical origin uses only the history available then, up to seven days, with at least three days before testing a daily outcome. Candidates are selected on an earlier tuning window, followed by a 24-hour embargo and a separate later validation window. At least 24 checks, 55% direction accuracy and 5% less error than no change are required. Buy additionally requires a daily dip and at least 20 earlier daily dips with a 55% rebound rate. A 90th-percentile historical error margin and selling fee must be cleared. Missing internal hours use neighbouring-price averages, but future observations cannot enter earlier tests. Missing days at the beginning are never filled.</p></details>}
  <details><summary>How the minute model is tested</summary><p>Momentum, mean reversion, ridge regression and a no-change baseline compete on an earlier tuning window. The winner is tested on a separate later window using only prices known at prediction time. The backend saves results for all four forecast horizons. Predictions reuse saved model coefficients between 15-minute training runs. Displayed directional accuracy measures historical tests; there is no 99% guarantee, and Wait is not counted as a correct price prediction. Internal missing minutes use the average of the nearest surrounding observed prices and are marked estimated. Test origins and targets must be recorded prices; future neighbours cannot affect an earlier prediction.</p><p>A signal requires at least 55% held-out directional accuracy, 5% less error than no change, and an estimated move exceeding the 0.1% selling fee and historical error margin. Buy also needs a recent dip below the 60-minute average and at least 20 similar historical dips with a 55% rebound rate. Sell requires a positive recorded holding, a known average cost, and strictly more than 0.1% net profit after the selling fee. Preserve benefit blocks and place trades manually in Torn.</p></details>
 </section>;
}
