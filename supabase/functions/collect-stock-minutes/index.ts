import {adminClient,json,preflight,scheduled} from '../_shared/http.ts';
import {boundedStockJson,watchlistMinutes,historyMinutes} from '../_shared/stock-minute-feed.ts';
import {STOCKS} from '../../../src/data/stocks.ts';
Deno.serve(async req=>{
 const early=preflight(req);if(early)return early;
 const admin=adminClient();
 if(!await scheduled(req,admin))return json({error:'Scheduled collector only'},403);
 const claim=await admin.rpc('claim_stock_collection');
 if(claim.error)return json({error:'Collector state unavailable'},503);
 if(!claim.data)return json({skipped:true});
 const {lease,backfill_id}=claim.data;
 try{
  // Provider publishes about 5–10 seconds after the minute. One lease bounds all upstream calls.
  await new Promise(resolve=>setTimeout(resolve,12000));
  const snapshot=watchlistMinutes(await boundedStockJson('https://tornsy.com/api/stocks'),Date.now()/1000);
  let points=snapshot.points,backfilled=false;
  const stock=STOCKS.find(s=>s.id===backfill_id);
  if(stock){
   try{const history=historyMinutes(await boundedStockJson(`https://tornsy.com/api/${stock.acronym}?interval=m1&limit=2000`),stock.id,snapshot.timestamp);
    if(history.length){points=[...snapshot.points,...history.filter(p=>p.timestamp!==snapshot.timestamp)];backfilled=true;}
   }catch{/* Keep the current 35 quotes; retry this stock's warmup next scheduled minute. */}
  }
  const result=await admin.rpc('finish_stock_collection',{p_lease:lease,p_provider_at:new Date(snapshot.timestamp*1000).toISOString(),p_points:points,p_backfilled:backfilled});
  if(result.error)throw new Error('Storage validation failed');
  return json({stored:result.data,provider_at:snapshot.timestamp,backfilled_stock:backfilled?stock?.id:null});
 }catch{
  await admin.rpc('finish_stock_collection',{p_lease:lease,p_provider_at:null,p_points:[],p_backfilled:false,p_error:'provider_unavailable'});
  return json({error:'Collection failed; earlier observations retained'},503);
 }
});
