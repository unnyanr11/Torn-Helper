import { CAPABILITIES } from '../api/capabilities';
import type { TornObservation } from './personal-data';
import { marketMinimum } from './travel-profit';
export const abortablePause=(ms:number,signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{
 if(signal.aborted)return reject(new DOMException('Cancelled','AbortError'));
 const finish=()=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);resolve();};
 const cancel=()=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);reject(new DOMException('Cancelled','AbortError'));};
 const timer=setTimeout(finish,ms);signal.addEventListener('abort',cancel,{once:true});
});
export function createTravelClient(invoke:(id:string,parameters:Record<string,string>,apiKey:string|undefined,signal:AbortSignal)=>Promise<TornObservation>,pause=abortablePause,now=()=>Date.now()){
 let tail=Promise.resolve(),lastStart=-Infinity;
 return (path:string,parameters:Record<string,string>,apiKey:string|undefined,signal:AbortSignal):Promise<TornObservation>=>{
  const job=tail.then(async()=>{
   if(signal.aborted)throw new DOMException('Cancelled','AbortError');
   const delay=Math.max(0,3400-(now()-lastStart));if(delay)await pause(delay,signal);
   if(signal.aborted)throw new DOMException('Cancelled','AbortError');
   const endpoint=CAPABILITIES.find(c=>c.path===path);if(!endpoint)throw new Error('Unsupported Torn section.');
   lastStart=now();return invoke(endpoint.id,parameters,apiKey,signal);
  });
  tail=job.then(()=>{},()=>{});return job;
 };
}
export type MarketScan={price:number|null;count:number;pages:number;complete:boolean;cacheTimes:number[];fetched_at:string;next:Record<string,string>|null};
export async function scanItemMarket(itemId:number,fetch:(params:Record<string,string>)=>Promise<TornObservation>,signal:AbortSignal,previous?:MarketScan):Promise<MarketScan>{
 const scan:MarketScan=previous?{...previous,cacheTimes:[...previous.cacheTimes]}:{price:null,count:0,pages:0,complete:false,cacheTimes:[],fetched_at:'',next:{id:String(itemId),limit:'100'}};
 const seen=new Set<string>();
 for(let page=0;page<5&&scan.next;page++){
  if(signal.aborted)throw new DOMException('Cancelled','AbortError');
  const params={...scan.next,id:String(itemId),limit:'100'},signature=JSON.stringify(Object.entries(params).sort());
  if(seen.has(signature))break;seen.add(signature);
  const r=await fetch(params);
  if(signal.aborted)throw new DOMException('Cancelled','AbortError');
  const m=marketMinimum(r.payload);
  if(m.price!==null)scan.price=scan.price===null?m.price:Math.min(scan.price,m.price);
  scan.count+=m.count;scan.pages++;scan.fetched_at=r.fetched_at;
  if(m.cacheTime!==null&&!scan.cacheTimes.includes(m.cacheTime))scan.cacheTimes.push(m.cacheTime);
  scan.next=r.next_parameters;
 }
 scan.complete=scan.next===null;
 return scan;
}
