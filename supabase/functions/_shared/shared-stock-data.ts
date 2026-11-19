import {budgetedTornFetch} from './torn-budget.ts';
import {tornGet} from './torn.ts';
import {LoginError} from './torn-login.ts';
type CacheRow={payload:unknown;fetched_at:string|null};
type Admin={
 rpc(name:string,args?:Record<string,unknown>):PromiseLike<{data:any;error:unknown}>;
 from(table:string):{
  select(columns:string):{eq(column:string,value:string):{maybeSingle():PromiseLike<{data:CacheRow|null;error:unknown}>}};
  update(values:Record<string,unknown>):{eq(column:string,value:string):{eq(column:string,value:string):PromiseLike<{error:unknown}>}};
 };
};
type StockSnapshot={payload:unknown;fetched_at:string;cached:boolean;stale:boolean};
export const isPublicStockEndpoint=(path:string)=>path==='/torn/stocks'||path==='/torn/{stockId}/stocks';

export async function sharedStockData(admin:Admin,path:string,fetcher:typeof fetch=fetch):Promise<StockSnapshot>{
 const url=new URL(path,'https://api.torn.com');
 const genericStocks=url.pathname==='/torn'&&url.searchParams.get('selections')==='stocks';
 if(url.origin!=='https://api.torn.com'||(!genericStocks&&!/^\/torn\/(stocks|([1-9]|[12]\d|3[0-5])\/stocks)$/.test(url.pathname)))
  throw new LoginError(400,'Choose one of the 35 supported public stocks.');
 url.searchParams.delete('timestamp');url.searchParams.delete('comment');url.searchParams.sort();
 if(genericStocks&&url.searchParams.size===1){url.pathname='/torn/stocks';url.searchParams.delete('selections');}
 const canonical=url.pathname+url.search;
 const saved=await admin.from('stock_public_cache').select('payload,fetched_at').eq('path',canonical).maybeSingle();
 if(saved.error)throw saved.error;
 const cache=saved.data;
 const savedTime=Date.parse(cache?.fetched_at??'');
 const present=cache?.payload&&Number.isFinite(savedTime);
 const now=Date.now();
 if(present&&savedTime<=now&&Math.floor(now/60000)===Math.floor(savedTime/60000))
  return {payload:cache.payload,fetched_at:cache.fetched_at!,cached:true,stale:false};
 const reservation=await admin.rpc('claim_stock_public_refresh',{p_path:canonical});
 if(reservation.error)throw reservation.error;
 if(!reservation.data){
  if(present)return {payload:cache!.payload,fetched_at:cache!.fetched_at!,cached:true,stale:true};
  throw new LoginError(503,'Shared stock prices are being refreshed. Retry shortly.');
 }
 try{
  const provider=await admin.rpc('get_shared_stock_provider');
  if(provider.error)throw provider.error;
  if(!provider.data?.api_key||!provider.data?.budget_owner)throw new LoginError(503,'Shared stock price collection is not configured.');
  const upstream=new URL(url);
  upstream.searchParams.set('timestamp',String(Math.floor(Date.now()/1000)));
  upstream.searchParams.set('comment','TornHelperSharedStocks');
  const payload=await tornGet(upstream.pathname+upstream.search,provider.data.api_key,budgetedTornFetch(admin,provider.data.budget_owner,fetcher));
  if(JSON.stringify(payload).includes(provider.data.api_key))throw new Error('Invalid shared stock response');
  const fetched_at=new Date().toISOString();
  const stored=await admin.from('stock_public_cache').update({payload,fetched_at,refresh_until:null,refresh_token:null}).eq('path',canonical).eq('refresh_token',reservation.data);
  if(stored.error)throw stored.error;
  return {payload,fetched_at,cached:false,stale:false};
 }catch(error){
  if(present)return {payload:cache!.payload,fetched_at:cache!.fetched_at!,cached:true,stale:true};
  throw error;
 }finally{
  await admin.from('stock_public_cache').update({refresh_until:null,refresh_token:null}).eq('path',canonical).eq('refresh_token',reservation.data);
 }
}
