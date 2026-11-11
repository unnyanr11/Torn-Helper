import { LoginError } from './torn-login.ts';
type BudgetAdmin={rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:any;error:unknown}>};
/** One shared server quota and expiring concurrency lease for each actual upstream call. */
export function budgetedTornFetch(admin:BudgetAdmin,ownerId:string,fetcher:typeof fetch=fetch):typeof fetch{
 return (async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(input instanceof Request?input.url:String(input));
  if(url.origin!=='https://api.torn.com')throw new Error('Unsupported upstream origin');
  const budget=await admin.rpc('consume_torn_data_budget',{owner_id:ownerId,cost:1});
  if(budget.error)throw budget.error;
  if(budget.data!==true)throw new LoginError(429,'Request limit reached. Wait a minute and retry.');
  const lease=await admin.rpc('torn_request_slot',{owner_id:ownerId,release_token:null});
  if(lease.error)throw lease.error;
  if(typeof lease.data!=='string')throw new LoginError(429,'Too many requests are already running. Retry shortly.');
  try{
   const response=await fetcher(input,{...init,redirect:'error',signal:init?.signal??AbortSignal.timeout(15000)});
   // Hold the lease through body consumption and bound upstream memory usage.
   const reader=response.body?.getReader(),chunks:Uint8Array[]=[];let size=0;
   if(reader)for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2097152){await reader.cancel();throw new LoginError(413,'Torn result is too large. Choose a smaller page or range.');}chunks.push(value);}
   const body=new Uint8Array(size);let offset=0;for(const part of chunks){body.set(part,offset);offset+=part.length;}
   const headers=new Headers(response.headers);headers.delete('content-encoding');headers.delete('content-length');
   return new Response(response.body===null?null:body,{status:response.status,statusText:response.statusText,headers});
  }finally{
   // A crashed worker's lease expires in 30 seconds, independently of this cleanup.
   try{await admin.rpc('torn_request_slot',{owner_id:ownerId,release_token:lease.data});}catch{/* Expiry recovers failed cleanup. */}
  }
 }) as typeof fetch;
}
