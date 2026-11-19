import './stock-forecast.css';
import {useLongTermChart} from '../hooks/useLongTermStocks';
import {useStockHorizonResults} from '../hooks/useStockHorizonResults';
import {stockHorizonDecision,SHORT_HORIZONS,LONG_HORIZONS,horizonLabel,type TradingMode} from '../lib/long-term-stock';
import {fillMissingStockMinutes} from '../lib/stock-minute-clean';
import type {StockHolding} from '../lib/stock-trade-decision';
import type {StockForecast} from '../lib/stock-forecast';
import {useStockChartHistory} from '../hooks/useStockChartHistory';
import StockPriceChart from './StockPriceChart';
import StockAdvice from './StockAdvice';
import {useStockStream} from '../hooks/useStockStream';
import StockHistoryExport from './StockHistoryExport';
import LiveStockPrices,{type StockLiveQuote} from './LiveStockPrices';
import {useEffect,useMemo,useState} from 'react';
import {stockChoices,stockLabel} from '../lib/stock-catalogue';
import SelectEntry from './SelectEntry';
const empty:StockForecast={points:[],last:null,cadence:3600,issue:'Saved analysis is unavailable.',predictedPrice:0,predictedReturn:0,lower:0,upper:0,tests:0,mae:0,baselineMae:0,directionAccuracy:0,supported:false,targetTime:0,validation:[]};
export default function MinuteStockLab({holdings=[]}:{holdings?:StockHolding[]}){
 const [liveQuotes,setLiveQuotes]=useState<StockLiveQuote[]>([]),[mode,setMode]=useState<TradingMode>('short');
 const [comparisonMinutes,setComparisonMinutes]=useState(1440),[shortHorizon,setShortHorizon]=useState(1),[longHorizon,setLongHorizon]=useState(168);
 const [selected,setSelected]=useState('2'),[archiveOpen,setArchiveOpen]=useState(false),[now,setNow]=useState(()=>Date.now()/1000);
 const horizonHours=mode==='short'?shortHorizon:longHorizon;
 const {status,connected}=useStockStream(),analysis=useStockHorizonResults(status.data?.provider_at);
 const rows=(analysis.data??[]).filter(row=>row.horizon_hours===horizonHours),chosen=rows.find(row=>row.stock_id===Number(selected));
 const forecasts=Object.fromEntries(rows.map(row=>[row.stock_id,row.forecast]));
 const chart=useStockChartHistory(Number(selected),status.data?.provider_at);
 const longChart=useLongTermChart(Number(selected),mode==='long',chosen?.computed_at);
 const minutePoints=useMemo(()=>chart.data?.points?fillMissingStockMinutes(chart.data.points):undefined,[chart.data]);
 const history=mode==='short'?minutePoints:longChart.data;
 const currentQuote=liveQuotes.find(q=>q.stock_id===Number(selected)),holding=holdings.find(h=>Number(h.stock_id)===Number(selected));
 const decision=stockHorizonDecision(currentQuote?chosen?.forecast:undefined,now,holding,currentQuote?{timestamp:Date.parse(currentQuote.observed_at)/1000,price:currentQuote.price}:undefined,mode);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()/1000),10000);return()=>clearInterval(timer);},[]);
 return <section className="card stock-forecast" aria-labelledby="minute-stock-title">
  <span className="badge">Shared server analysis · experimental models</span><h3 id="minute-stock-title">Stock trading lab</h3>
  <p>Choose a trading style and forecast horizon. The backend saves all 350 forecasts together every five minutes; opening this screen reads saved results. Accuracy is measured, not guaranteed.</p>
  <p className="muted">Prices use the shared backend key; <a href="https://tornsy.com/api" target="_blank" rel="noreferrer">Tornsy</a> supplies historical backfill and fallback prices. We retain minute prices for 30 days online and hourly closes for 120 days to evaluate longer forecasts.</p>
  <div className="stock-forecast-controls">
   <label>Trading style<select className="nu-input" aria-label="Trading style" value={mode} onChange={e=>{setMode(e.target.value as TradingMode);setComparisonMinutes(1440);}}><option value="short">Short-term trading</option><option value="long">Long-term trading</option></select></label>
   <SelectEntry label="Stock" searchable allowCustom={false} value={selected} options={stockChoices()} onChange={e=>setSelected(e.target.value)}/>
   <label>Forecast ahead<select className="nu-input" aria-label="Forecast ahead" value={horizonHours} onChange={e=>(mode==='short'?setShortHorizon:setLongHorizon)(Number(e.target.value))}>{(mode==='short'?SHORT_HORIZONS:LONG_HORIZONS).map(hours=><option key={hours} value={hours}>{horizonLabel(hours)}</option>)}</select></label>
   <button className="nu-btn" type="button" disabled={analysis.isFetching} onClick={()=>void analysis.refetch()}>Check latest results</button>
  </div>
  <p className="muted">Buy/Wait uses shared market history, including prices collected before you signed in. The forecast horizon is separate from the chart’s comparison range. Hold and Sell require stocks you own; Sell also requires strictly more than 0.1% net profit after the selling fee.</p>
  <h4>Suggested {mode==='long'?'long-term':'short-term'} action for {stockLabel(selected)} · next {horizonLabel(horizonHours)}</h4>
  <StockAdvice now={now} holding={holding} decision={decision}/>
  {analysis.isPending&&<p role="status">Loading saved server analysis…</p>}
  {analysis.isError&&<p role="alert">Saved forecasts could not be refreshed. <button className="nu-btn" onClick={()=>void analysis.refetch()}>Retry forecasts</button></p>}
  {chosen&&<details><summary>Forecast evidence and history coverage</summary>
   <p>Available history: {chosen.forecast.historyDays.toFixed(1)} days · {(chosen.forecast.coverage*100).toFixed(1)}% recorded hourly coverage. {chosen.forecast.historyDays<30?'A full month is not yet available. Missing leading days are never fabricated.':''}</p>
   <p>Model: {chosen.forecast.model} · {chosen.forecast.tests} held-out checks for {horizonLabel(horizonHours)} outcomes · {(chosen.forecast.directionAccuracy*100).toFixed(1)}% direction correct. Overlapping outcomes are not independent trading trials.</p>
   {chosen.forecast.issue&&<p>{chosen.forecast.issue}</p>}
   <p>Backend batch: 35 stocks · 350 forecasts in {(chosen.batch_ms/1000).toFixed(3)} seconds. Updated {new Date(chosen.computed_at).toLocaleString()}.</p>
  </details>}
  {!!history?.length&&<StockPriceChart longTerm={mode==='long'} forecast={chosen?.forecast??empty} history={history} name={stockLabel(selected)} comparisonMinutes={comparisonMinutes} onComparisonChange={setComparisonMinutes} now={now}/>}
  {(mode==='short'?chart.isPending:!!chosen&&longChart.isPending)&&<p role="status">Loading recorded chart prices…</p>}
  {(mode==='short'?chart.isError:longChart.isError)&&<p role="alert">Chart unavailable. <button className="nu-btn" onClick={()=>void (mode==='short'?chart.refetch():longChart.refetch())}>Retry chart</button></p>}
  <LiveStockPrices onPrices={setLiveQuotes} mode={mode} horizonHours={horizonHours} longAnalyses={forecasts} comparisonMinutes={comparisonMinutes} holdings={holdings} at={status.data?.provider_at} connected={connected} onSelect={setSelected} now={now}/>
  <details onToggle={e=>setArchiveOpen(e.currentTarget.open)}><summary>Online minute price table and spreadsheet export</summary>
   <p>The optional archive contains the last seven days of recorded minutes. CSV opens in Excel or Google Sheets.</p>
   {archiveOpen&&<StockHistoryExport selected={selected} providerAt={status.data?.provider_at} backfilled={status.data?.backfilled_stocks}/>}
  </details>
  <details><summary>How these forecasts are tested</summary>
   <p>Each horizon has its own future price targets, model selection, error margin and validation. Short-term forecasts use the latest seven days of hourly samples. Long-term validation can use up to 120 days of hourly history; recent trends compare daily, weekly and monthly prices. Momentum, mean reversion, a blend and no change compete on earlier tuning data. A full forecast-horizon embargo separates tuning outcomes from later validation origins. Forecasts require at least 24 held-out checks, 55% direction accuracy and 5% less error than no change. Longer horizons need history spanning multiple forecast periods; without it, the result is Wait.</p>
   <p>Buy requires a daily dip below the recent average, at least 20 earlier similar dips and 55% recoveries within the selected forecast horizon. Fees and the historical error margin must be cleared. Sell needs positive shares, a known purchase cost, more than 0.1% net profit after fees and a validated decline. Preserve benefit blocks and place trades manually in Torn.</p>
  </details>
 </section>;
}
