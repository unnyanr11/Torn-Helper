import {stockWindowLabel,stockWindowPosition,type StockWindowExtreme} from '../lib/stock-window';
const money=(price:number)=>price.toLocaleString(undefined,{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});
const date=(at:string)=>new Date(at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
export default function StockWindowRange({current,range,minutes}:{current:number;range:StockWindowExtreme;minutes:number}){
 const result=stockWindowPosition(current,range);if(!result)return <span>Range data unavailable</span>;
 return <span className="stock-window-range">
  <span className="stock-window-period">Recorded {stockWindowLabel(minutes)} range</span>
  <span className="stock-extreme-grid">
   <span><b>Low {money(range.low)}</b><time dateTime={range.low_at}>{date(range.low_at)}</time></span>
   <span><b>High {money(range.high)}</b><time dateTime={range.high_at}>{date(range.high_at)}</time></span>
  </span>
  {result.position===null?<span>No price variation in this window</span>:<>
   <span className="stock-window-meter" role="meter" aria-label="Current price position between the recorded low and high" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(result.position)} aria-valuetext={`${result.position.toFixed(0)}% of the range: 0 is the low, 100 is the high`}><i style={{left:`${result.position}%`}}/></span>
   <span>{result.position.toFixed(0)}% from low toward high</span>
  </>}
  <span className="stock-range-distances">{result.aboveLow>=0?'+':''}{result.aboveLow.toFixed(2)}% from low · {result.belowHigh>0?'−':''}{Math.abs(result.belowHigh).toFixed(2)}% from high</span>
  <span className="stock-range-coverage">{range.observed_points.toLocaleString()}/{minutes.toLocaleString()} recorded minutes</span>
 </span>;
}
