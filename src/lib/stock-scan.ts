import type {TornObservation} from './personal-data';
import {HISTORY_ENDPOINT} from './stock-forecast';
/** Explicit, bounded scan. No polling, retries, padding or unrelated personal datasets. */
export async function scanStockHistory(options:{
 ids:number[];signal:AbortSignal;force?:boolean;now?:()=>number;
 saved:(id:number)=>TornObservation|undefined;
 fetch:(id:number,signal:AbortSignal)=>Promise<TornObservation>;
 pause:(ms:number,signal:AbortSignal)=>Promise<void>;
 progress:(done:number,total:number)=>void;
}){
 const ids=[...new Set(options.ids)].filter(id=>Number.isSafeInteger(id)&&id>0).slice(0,35);
 let done=0,requests=0;
 for(const id of ids){
  if(options.signal.aborted)break;
  const saved=options.saved(id),age=(options.now?.()??Date.now())-Date.parse(saved?.fetched_at??'');
  const reusable=!options.force&&saved?.endpoint_id===HISTORY_ENDPOINT&&saved.parameters.stockId===String(id)&&age>=0&&age<900000;
  if(!reusable){
   if(requests)await options.pause(3400,options.signal);
   if(options.signal.aborted)break;
   await options.fetch(id,options.signal);requests++;
  }
  if(options.signal.aborted)break;
  options.progress(++done,ids.length);
 }
 return {done,total:ids.length,stopped:options.signal.aborted};
}

export const stockScanPause=(ms:number,signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{
 if(signal.aborted)return reject(new DOMException('Cancelled','AbortError'));
 const cancel=()=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);reject(new DOMException('Cancelled','AbortError'));};
 const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},ms);
 signal.addEventListener('abort',cancel,{once:true});
});
