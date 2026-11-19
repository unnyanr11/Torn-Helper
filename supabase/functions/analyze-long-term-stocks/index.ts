import {adminClient,json,preflight,scheduled} from '../_shared/http.ts';
import {forecastLongTermStock,FORECAST_HOURS} from '../../../src/lib/long-term-stock.ts';
Deno.serve(async req=>{
 const early=preflight(req);if(early)return early;
 const admin=adminClient();if(!await scheduled(req,admin))return json({error:'Scheduled analysis only'},403);
 const started=new Date().toISOString(),clock=performance.now();
 const input=await admin.rpc('read_stock_long_term_input');
 if(input.error||!input.data?.provider_at||Object.keys(input.data.stocks??{}).length!==35)return json({error:'Complete stock history unavailable'},503);
 const {provider_at,stocks}=input.data;
 if(Date.now()-Date.parse(provider_at)>180000)return json({error:'Current prices are stale'},503);
 const results=[],charts=[];
 for(let stock_id=1;stock_id<=35;stock_id++){
  const points=(stocks[stock_id]??[]).map(([timestamp,price]:[number,number])=>({timestamp,price:Number(price)}));
  for(const horizon_hours of FORECAST_HOURS){
   const start=performance.now();
   const forecast=forecastLongTermStock(points,horizon_hours,horizon_hours<=24?7:120);
   if(forecast.last?.timestamp!==Date.parse(provider_at)/1000)return json({error:'Current stock batch is incomplete'},503);
   const processing_ms=performance.now()-start;
   results.push({stock_id,horizon_hours,forecast:{...forecast,points:[],validation:[]},processing_ms});
   if(horizon_hours===24)charts.push({stock_id,forecast:{...forecast,points:points.filter((p:{timestamp:number})=>p.timestamp>Date.parse(provider_at)/1000-30*86400)},processing_ms});
  }
 }
 const saved=await admin.rpc('publish_stock_horizons',{p_provider_at:provider_at,p_started_at:started,p_results:results,p_charts:charts});
 if(saved.error||!saved.data)return json({error:'Analysis could not be saved; previous results retained'},503);
 return json({stocks:35,forecasts:results.length,provider_at,duration_ms:performance.now()-clock});
});
