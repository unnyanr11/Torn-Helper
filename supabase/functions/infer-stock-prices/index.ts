import {adminClient,json,preflight,scheduled} from '../_shared/http.ts';
import {inferStockMinute} from '../_shared/stock-inference.ts';
import {STOCK_ANALYSIS_VERSION} from '../_shared/stock-analysis.ts';
Deno.serve(async req=>{
 const started=new Date().toISOString(),clock=performance.now();
 const early=preflight(req);if(early)return early;
 const admin=adminClient();if(!await scheduled(req,admin))return json({error:'Scheduled inference only'},403);
 const input=await admin.rpc('read_stock_inference_input');
 if(input.error)return json({error:'Inference input unavailable'},503);
 const {provider_at,models,prices}=input.data??{};
 if(!provider_at||!Array.isArray(models)||models.length!==140)return json({warming:true,error:'Initial model fitting is not complete'},503);
 const now=Date.now()/1000,results=[];
 for(const row of models){
  if(row.model_version!==STOCK_ANALYSIS_VERSION)return json({warming:true,error:'Model version is being updated'},503);
  const points=(prices?.[row.stock_id]??[]).map(([timestamp,price]:[number,number])=>({timestamp,price:Number(price)}));
  const start=performance.now(),forecast=inferStockMinute(row.forecast,points,now,row.horizon);
  if(forecast.last?.timestamp!==Date.parse(provider_at)/1000)return json({error:'Current stock batch is incomplete'},503);
  results.push({stock_id:row.stock_id,horizon:row.horizon,forecast,history_from:row.history_from,history_to:row.history_to,processing_ms:performance.now()-start});
 }
 const saved=await admin.rpc('publish_stock_inference',{p_provider_at:provider_at,p_model_version:STOCK_ANALYSIS_VERSION,p_started_at:started,p_results:results});
 if(saved.error||!saved.data)return json({error:'Inference could not be saved; previous results retained'},503);
 return json({stocks:35,forecasts:results.length,duration_ms:performance.now()-clock,provider_at});
});
