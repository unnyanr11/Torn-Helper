import {resolveRefreshKey} from '../_shared/live-refresh.ts';
import {budgetedTornFetch} from '../_shared/torn-budget.ts';
import {tornGet,TornApiError} from '../_shared/torn.ts';
import {adminClient,json,preflight,scheduled} from '../_shared/http.ts';
import {boundedStockJson,watchlistMinutes,historyMinutes,officialStockMinutes,type MinutePoint} from '../_shared/stock-minute-feed.ts';
import {STOCKS} from '../../../src/data/stocks.ts';
Deno.serve(async req=>{
 const early=preflight(req);if(early)return early;
 const admin=adminClient();
 if(!await scheduled(req,admin))return json({error:'Scheduled collector only'},403);
 const claim=await admin.rpc('claim_stock_collection');
 if(claim.error)return json({error:'Collector state unavailable'},503);
 if(!claim.data)return json({skipped:true});
 const {lease,backfill_id,full_week}=claim.data;
 try{
  // Provider publishes about 5–10 seconds after the minute. One lease bounds all upstream calls.
  await new Promise(resolve=>setTimeout(resolve,12000));
  let adminSnapshot:ReturnType<typeof watchlistMinutes>|undefined;
  const owner=await admin.rpc('get_stock_collector_owner');
  if(!owner.error&&typeof owner.data==='string'){
   try{
    const key=await resolveRefreshKey(admin,owner.data,undefined,Deno.env.get('TORN_KEY_ENCRYPTION_KEY'));
    const payload=await tornGet(`/torn/stocks?timestamp=${Math.floor(Date.now()/1000)}&comment=TornHelperSharedStockCollector`,key,budgetedTornFetch(admin,owner.data));
    adminSnapshot=officialStockMinutes(payload,Date.now()/1000);
   }catch(error){
    if(error instanceof TornApiError&&[2,10,13,16,18].includes(error.code??-1))await admin.rpc('disable_stock_collector_key',{p_owner:owner.data});
   }
  }
  const snapshot=adminSnapshot??watchlistMinutes(await boundedStockJson('https://tornsy.com/api/stocks'),Date.now()/1000);
  let points=snapshot.points,backfilled=false;
  const stock=STOCKS.find(s=>s.id===backfill_id);
  if(stock){
   try{
    const pages=full_week?6:1,history:MinutePoint[]=[];
    let complete=true;
    // At most three requests in flight; each page stays within the provider's 2,000-row cap.
    for(let page=0;page<pages;page+=3){
     const batch=await Promise.allSettled(Array.from({length:Math.min(3,pages-page)},async(_,offset)=>{
      const index=page+offset,to=snapshot.timestamp-index*2000*60+60;
      const from=Math.max(snapshot.timestamp-7*86400+60,to-2000*60);
      const url=`https://tornsy.com/api/${stock.acronym}?interval=m1&limit=2000&from=${from}&to=${to}`;
      return historyMinutes(await boundedStockJson(url),stock.id,snapshot.timestamp);
     }));
     for(const result of batch){if(result.status==='fulfilled')history.push(...result.value);else complete=false;}
    }
    points=[...snapshot.points,...history.filter(p=>p.timestamp!==snapshot.timestamp)];
    backfilled=complete&&history.length>0;
   }catch{/* Keep current quotes; retry this stock's weekly warmup next scheduled minute. */}
  }
  const result=await admin.rpc('finish_stock_collection',{p_lease:lease,p_provider_at:new Date(snapshot.timestamp*1000).toISOString(),p_points:points,p_backfilled:backfilled});
  if(result.error)throw new Error('Storage validation failed');
  return json({stored:result.data,provider_at:snapshot.timestamp,backfilled_stock:backfilled?stock?.id:null});
 }catch{
  await admin.rpc('finish_stock_collection',{p_lease:lease,p_provider_at:null,p_points:[],p_backfilled:false,p_error:'provider_unavailable'});
  return json({error:'Collection failed; earlier observations retained'},503);
 }
});
