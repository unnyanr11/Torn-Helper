import {useAllStockHistory} from '../hooks/useAllStockHistory';
import {stockLabel} from '../lib/stock-catalogue';
import {downloadBlob} from '../lib/export';
export default function StockHistoryExport({selected,providerAt,backfilled}:{selected:string;providerAt?:string|null;backfilled?:number}){
 const history=useAllStockHistory(providerAt,backfilled),points=history.data?.stocks[selected]??[];
 function exportCsv(){
  const quote=(value:string|number)=>`"${String(value).replace(/"/g,'""')}"`;
  const rows=[['Stock','Observed at (UTC)','Price','Source'],...points.map(p=>[stockLabel(selected),new Date(p.timestamp*1000).toISOString(),p.price,p.source??'Shared collector'])];
  downloadBlob(new Blob([rows.map(row=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),`stock-${selected}-minute-history.csv`);
 }
 return <div>
  {history.isPending&&<p role="status">Loading the weekly archive for export…</p>}
  {history.isError&&<p role="alert">The archive could not be loaded. <button className="nu-btn" onClick={()=>void history.refetch()}>Retry</button></p>}
  <button className="nu-btn" disabled={!points.length} onClick={exportCsv}>Download loaded minute prices (CSV)</button>
  <div className="stock-forecast-table"><table><thead><tr><th>Source minute</th><th>Price</th><th>Source</th></tr></thead><tbody>{[...points].reverse().slice(0,120).map(p=><tr key={p.timestamp}><td>{new Date(p.timestamp*1000).toLocaleString()}</td><td>${p.price.toFixed(2)}</td><td>{p.source??'Shared collector'}</td></tr>)}</tbody></table></div>
  <p>Showing the latest 120 observations. CSV contains {points.length.toLocaleString()} loaded observations for this stock.</p>
 </div>;
}
