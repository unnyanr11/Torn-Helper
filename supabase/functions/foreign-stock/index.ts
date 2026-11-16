import {json,preflight,adminClient,authenticate} from '../_shared/http.ts';
import {foreignStocks,type ForeignStock} from '../_shared/foreign-stock.ts';
import {readJsonObject} from '../_shared/request-body.ts';

type Snapshot={rows:ForeignStock[];source:string;fetched_at:string};
let cached:Snapshot|undefined;
let pending:Promise<Snapshot>|undefined;
async function load():Promise<Snapshot>{
 // Fixed public sources only. No user key or account data is sent upstream.
 for(const source of ['https://yata.yt/api/v1/travel/export/','https://torn-tracker.com/api/v1/travel/export/']){
  try{
   const response=await fetch(source,{signal:AbortSignal.timeout(8000),redirect:'error'});
   if(!response.ok)continue;
   const body=await readJsonObject(new Request('https://stock.invalid',{method:'POST',body:response.body,duplex:'half'} as RequestInit),json);
   if(body instanceof Response)continue;
   const snapshot={rows:foreignStocks(body),source,fetched_at:new Date().toISOString()};
   cached=snapshot;
   return snapshot;
  }catch{/* Try the next public provider. */}
 }
 throw new Error('Stock providers are unavailable');
}
Deno.serve(async req=>{
 const early=preflight(req);if(early)return early;
 try{
  const user=await authenticate(req,adminClient());
  if(!user)return json({error:'Sign in to check foreign stock'},401);
  if(cached&&Date.now()-Date.parse(cached.fetched_at)<60000)return json(cached);
  if(!pending)pending=load().finally(()=>{pending=undefined;});
  return json(await pending);
 }catch{
  if(cached)return json({...cached,warning:'Refresh failed. Showing the previous stock report.'});
  return json({error:'Foreign stock reports are temporarily unavailable. Retry shortly.'},503);
 }
});
