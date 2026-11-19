import {expect,it} from 'vitest';
import {stockTradeDecision} from '../lib/stock-trade-decision';
import type {StockForecast} from '../lib/stock-forecast';
import {fillMissingStockMinutes} from '../lib/stock-minute-clean';
import {forecastMinuteStock,scoreForwardPredictions} from '../lib/minute-forecast';
const now=1794000000;
const down:StockForecast={points:[],last:{timestamp:now,price:100},cadence:60,targetTime:now+60,supported:true,lower:96,upper:98,predictedPrice:97,predictedReturn:-.03,tests:80,mae:.001,baselineMae:.002,directionAccuracy:.6,validation:[]};
it('shows Sell only for positive holdings with more than 0.1% net profit after the fee',()=>{
 const holding={stock_id:'2',shares:100,avg_cost:99.9/1.001};
 expect(stockTradeDecision(down,now).signal).toBe('Wait');
 expect(stockTradeDecision(down,now,{...holding,shares:0}).signal).toBe('Wait');
 expect(stockTradeDecision(down,now,{...holding,avg_cost:null}).signal).toBe('Wait');
 expect(stockTradeDecision(down,now,holding).signal).toBe('Wait');
 expect(stockTradeDecision(down,now,{...holding,avg_cost:99.9/1.0011}).signal).toBe('Sell / rebuy watch');
 expect(stockTradeDecision(down,now,{...holding,avg_cost:100}).signal).toBe('Wait');
});
it('requires a dip, historical rebound evidence, and the existing model checks for Buy',()=>{
 const up={...down,lower:102,upper:104,predictedPrice:103,predictedReturn:.03,dip:{present:true,dropReturn:-.01,tests:20,reboundRate:.55}};
 expect(stockTradeDecision(up,now).signal).toBe('Buy candidate');
 expect(stockTradeDecision({...up,dip:{...up.dip,present:false}},now).signal).toBe('Wait');
 expect(stockTradeDecision({...up,dip:{...up.dip,tests:19}},now).signal).toBe('Wait');
 expect(stockTradeDecision({...up,dip:{...up.dip,reboundRate:.54}},now).signal).toBe('Wait');
 expect(stockTradeDecision({...up,supported:false},now).signal).toBe('Wait');
});
it('fills internal gaps with nearest-neighbour averages and never extrapolates the tail',()=>{
 const result=fillMissingStockMinutes([{timestamp:now,price:100},{timestamp:now+180,price:106}]);
 expect(result).toEqual([{timestamp:now,price:100},{timestamp:now+60,price:103,estimated:true,availableAt:now+180},{timestamp:now+120,price:103,estimated:true,availableAt:now+180},{timestamp:now+180,price:106}]);
});
it('keeps estimated values out of validation targets and forward scoring',()=>{
 const points=Array.from({length:600},(_,i)=>({timestamp:now+i*60,price:100*1.0001**i})).filter((_,i)=>i!==590);
 const forecast=forecastMinuteStock(points,now+599*60+10);
 expect(forecast.imputedCount).toBe(1);
 expect(forecast.validation.every(v=>v.timestamp!==now+590*60)).toBe(true);
 expect(scoreForwardPredictions([{targetTime:now+60,predictedPrice:102,originPrice:100}],[{timestamp:now+60,price:102,estimated:true}]).tests).toBe(0);
 const altered=forecastMinuteStock(points.map(p=>p.timestamp===now+591*60?{...p,price:p.price*1.01}:p),now+599*60+10);
 expect(altered.validation.filter(v=>v.timestamp<now+590*60)).toEqual(forecast.validation.filter(v=>v.timestamp<now+590*60));
});
