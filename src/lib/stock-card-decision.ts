import {stockTradeDecision,type StockHolding} from './stock-trade-decision';
import type {StockDecision,StockForecast,StockWaitBlocker} from './stock-forecast';
export const WAIT_LABELS:Record<StockWaitBlocker,string>={data:'Analysis unavailable',stale:'Forecast is outdated',baseline:'No advantage over an unchanged price',validation:'Past predictions not reliable enough',fees:'Expected move too small after costs',ownership:'No recorded shares',cost:'Purchase cost needed',profit:'Net profit must exceed 0.1%',dip:'Waiting for a price dip',rebound:'Rebound evidence too weak',updating:'Updating for newer prices'};
export function stockCardDecision(forecast:StockForecast|undefined,observedAt:string,now:number,holding?:StockHolding):StockDecision{
 if(!forecast)return {signal:'Wait',blocker:'data',reason:'No saved analysis is available yet.',stale:true,netReturn:0,buyCeiling:0,rebuyCeiling:0};
 if(forecast.issue)return stockTradeDecision(forecast,now,holding);
 if(forecast.last?.timestamp!==Date.parse(observedAt)/1000)return {signal:'Wait',blocker:'updating',reason:'A newer recorded quote is available. The backend is updating this forecast.',stale:false,netReturn:0,buyCeiling:0,rebuyCeiling:0};
 return stockTradeDecision(forecast,now,holding);
}
