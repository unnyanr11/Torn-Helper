import {forecastMinuteStock,type MinuteHorizon} from '../lib/minute-forecast';
import type {PricePoint} from '../lib/stock-forecast';
self.onmessage=(event:MessageEvent<{points:PricePoint[];now:number;horizon:MinuteHorizon}>)=>{
 try{self.postMessage({forecast:forecastMinuteStock(event.data.points,event.data.now,event.data.horizon)});}
 catch{self.postMessage({error:'Minute model could not be trained. Try refreshing the history.'});}
};
