import {adminClient,json,preflight,scheduled} from '../_shared/http.ts';
import {readJsonObject} from '../_shared/request-body.ts';
import {analyzeStockHistory,STOCK_ANALYSIS_VERSION} from '../_shared/stock-analysis.ts';
import type {PricePoint} from '../../../src/lib/stock-forecast.ts';
Deno.serve(async req=>{
 const early=preflight(req);if(early)return early;
 const admin=adminClient();
 if(!await scheduled(req,admin))return json({error:'Scheduled analysis only'},403);
 const body=await readJsonObject(req,json);
 if(body instanceof Response)return body;
 const stockId=body.stock_id;
 if(!Number.isInteger(stockId)||stockId<1||stockId>35)return json({error:'Invalid stock'},400);
 const claim=await admin.rpc('claim_stock_analysis',{p_stock_id:stockId,p_model_version:STOCK_ANALYSIS_VERSION});
 if(claim.error)return json({error:'Analysis state unavailable'},503);
 if(!claim.data)return json({skipped:true});
 const {lease,provider_at}=claim.data;
 try{
  const history=await admin.rpc('read_stock_chart_history',{p_stock_id:stockId,p_after:null});
  if(history.error||!Array.isArray(history.data?.points)){console.error('stock-history-read',stockId,history.error?.code);throw new Error('History unavailable');}
  const observed=Date.parse(provider_at)/1000;
  const points=(history.data.points as [number,number][]).map(([timestamp,price])=>({timestamp,price:Number(price)})).filter(p=>p.timestamp<=observed);
  const results=analyzeStockHistory(points,Date.now()/1000);
  const stored=await admin.rpc('finish_stock_analysis',{p_stock_id:stockId,p_lease:lease,p_results:results});
  if(stored.error||!stored.data){console.error('stock-analysis-write',stockId,stored.error?.code);throw new Error('Analysis cache write failed');}
  return json({stock_id:stockId,stored:results.length,processing_ms:results.reduce((n,r)=>n+r.processing_ms,0)});
 }catch{
  await admin.rpc('finish_stock_analysis',{p_stock_id:stockId,p_lease:lease,p_results:null});
  return json({error:'Stock analysis could not complete. Previous results retained.'},503);
 }
});
