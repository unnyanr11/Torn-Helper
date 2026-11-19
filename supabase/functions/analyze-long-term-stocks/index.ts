import {adminClient,json,preflight,scheduled} from '../_shared/http.ts';
import {forecastLongTermStock} from '../../../src/lib/long-term-stock.ts';
Deno.serve(async req=>{
 const early=preflight(req);if(early)return early;
 const admin=adminClient();if(!await scheduled(req,admin))return json({error:'Scheduled analysis only'},403);
 const started=new Date().toISOString(),clock=performance.now();
 const input=await admin.rpc('read_stock_long_term_input');
 if(input.error||!input.data?.provider_at||Object.keys(input.data.stocks??{}).length!==35)return json({error:'Complete stock history unavailable'},503);
 const {provider_at,stocks}=input.data;
 if(Date.now()-Date.parse(provider_at)>180000)return json({error:'Current prices are stale'},503);
 const results=[];
 for(let stock_id=1;stock_id<=35;stock_id++){
  const start=performance.now();
  const forecast=forecastLongTermStock((stocks[stock_id]??[]).map(([timestamp,price]:[number,number])=>({timestamp,price:Number(price)})));
  if(forecast.last?.timestamp!==Date.parse(provider_at)/1000)return json({error:'Current stock batch is incomplete'},503);
  results.push({stock_id,forecast,processing_ms:performance.now()-start});
 }
 const saved=await admin.rpc('publish_stock_long_term',{p_provider_at:provider_at,p_started_at:started,p_results:results});
 if(saved.error||!saved.data)return json({error:'Analysis could not be saved; previous results retained'},503);
 return json({stocks:35,provider_at,duration_ms:performance.now()-clock});
});
