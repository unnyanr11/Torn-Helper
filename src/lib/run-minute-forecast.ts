import type {PricePoint} from './stock-forecast';
import type {MinuteForecast,MinuteHorizon} from './minute-forecast';
export const MODEL_TIME_LIMIT_MS=10000;
export const MODEL_TIMEOUT_MESSAGE='Wait: analysis exceeded 10 seconds and was stopped. Refresh or try again; no new prediction was produced.';
type Callbacks={result:(forecast:MinuteForecast,milliseconds:number)=>void;error:(message:string)=>void};
/** Deadline includes worker startup, computation and delivery; history downloads are separate. */
export function runMinuteForecast(points:PricePoint[],now:number,horizon:MinuteHorizon,callbacks:Callbacks,createWorker=()=>new Worker(new URL('../workers/minute-forecast.worker.ts',import.meta.url),{type:'module'})){
 const started=performance.now();let worker:Worker|undefined,finished=false;
 const stop=()=>{if(finished)return false;finished=true;clearTimeout(deadline);worker?.terminate();return true;};
 const fail=(message:string)=>{if(stop())callbacks.error(message);};
 const deadline=setTimeout(()=>fail(MODEL_TIMEOUT_MESSAGE),MODEL_TIME_LIMIT_MS);
 try{
  worker=createWorker();
  worker.onmessage=event=>{
   if(finished)return;
   const elapsed=performance.now()-started;
   if(elapsed>=MODEL_TIME_LIMIT_MS){fail(MODEL_TIMEOUT_MESSAGE);return;}
   if(event.data.error){fail(String(event.data.error));return;}
   if(!event.data.forecast){fail('Model returned no analysis. Refresh minute history to retry.');return;}
   if(stop())callbacks.result(event.data.forecast as MinuteForecast,elapsed);
  };
  worker.onerror=()=>fail('Model analysis failed. Refresh minute history to retry.');
  worker.postMessage({points,now,horizon});
 }catch{fail('Background model analysis is unavailable in this browser.');}
 return ()=>{stop();};
}
/** Every observation participates in the key: a changed historical price cannot reuse an old fit. */
export function minuteForecastCacheKey(stock:string,horizon:MinuteHorizon,points:PricePoint[]){
 return `${stock}:${horizon}:`+points.map(p=>`${p.timestamp},${p.price}`).join(';');
}
