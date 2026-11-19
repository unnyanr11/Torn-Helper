import {forecastMinuteStock,MINUTE_MODEL_VERSION,type MinuteHorizon} from '../../../src/lib/minute-forecast.ts';
import type {PricePoint} from '../../../src/lib/stock-forecast.ts';
export const STOCK_ANALYSIS_VERSION='server-'+MINUTE_MODEL_VERSION;
export function analyzeStockHistory(points:PricePoint[],now:number){
 // Horizons share identical input features; only their future labels differ.
 const features=new Map<number,number[]>();
 return ([1,5,15,60] as MinuteHorizon[]).map(horizon=>{
  const started=performance.now();
  const result=forecastMinuteStock(points,now,horizon,features);
  return {
   horizon,processing_ms:performance.now()-started,
   history_from:result.points[0]?.timestamp??null,history_to:result.last?.timestamp??null,
   // The complete week trains the model; the UI needs a short chart and summary.
   forecast:{...result,points:result.points.slice(-60),validation:result.validation.slice(-20)},
  };
 });
}
