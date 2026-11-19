import {forecastMinuteStock,type MinuteHorizon} from '../lib/minute-forecast';
import type {StockBatch} from '../lib/stock-batch';
self.onmessage=(event:MessageEvent<{stocks:StockBatch['stocks'];now:number;horizon:MinuteHorizon;priority:string}>)=>{
 const {stocks,now,horizon,priority}=event.data;
 const ids=Object.keys(stocks).sort((a,b)=>a===priority?-1:b===priority?1:Number(a)-Number(b));
 for(const id of ids){
  const started=performance.now();
  try{
   const forecast=forecastMinuteStock(stocks[id],now,horizon);
   self.postMessage({id,forecast,milliseconds:performance.now()-started});
  }catch{/* This stock remains on Wait; other stocks can still be analysed. */}
 }
 self.postMessage({done:true});
};
