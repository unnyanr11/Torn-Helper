import type {StockBatch} from './stock-batch';
import type {MinuteForecast,MinuteHorizon} from './minute-forecast';
import {MODEL_TIME_LIMIT_MS} from './run-minute-forecast';
export function runAllStockForecasts(stocks:StockBatch['stocks'],now:number,horizon:MinuteHorizon,priority:string,onResult:(id:string,forecast:MinuteForecast,milliseconds:number)=>void,onDone:(message:string)=>void){
 const started=performance.now();let worker:Worker|undefined,finished=false;
 const stop=()=>{if(finished)return;finished=true;clearTimeout(deadline);worker?.terminate();};
 const deadline=setTimeout(()=>{stop();onDone('Analysis reached its 10-second limit. Stocks without a completed result remain on Wait.');},MODEL_TIME_LIMIT_MS);
 try{
  worker=new Worker(new URL('../workers/all-stock-forecasts.worker.ts',import.meta.url),{type:'module'});
  worker.onmessage=event=>{
   if(finished)return;
   if(event.data.done){stop();onDone('');return;}
   if(performance.now()-started>=MODEL_TIME_LIMIT_MS){stop();onDone('Analysis reached its 10-second limit. Remaining stocks stay on Wait.');return;}
   if(event.data.forecast)onResult(event.data.id,event.data.forecast,event.data.milliseconds);
  };
  worker.onerror=()=>{stop();onDone('Analysis could not finish. Stocks without a result stay on Wait.');};
  worker.postMessage({stocks,now,horizon,priority});
 }catch{stop();onDone('Background analysis is unavailable. Wait for a completed analysis.');}
 return stop;
}
