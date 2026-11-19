import {expect,it} from 'vitest';
import {analyzeStockHistory} from '../../supabase/functions/_shared/stock-analysis';
import {forecastMinuteStock,WEEK_MINUTES} from '../lib/minute-forecast';
it('trains on the full week and caches all horizons with a compact chart',()=>{
 const points=Array.from({length:WEEK_MINUTES},(_,i)=>({timestamp:1794000000+i*60,price:100+Math.sin(i/30)+i*.0001}));
 const rows=analyzeStockHistory(points,points.at(-1)!.timestamp+15);
 expect(rows.map(row=>row.horizon)).toEqual([1,5,15,60]);
 for(const row of rows){
  const standalone=forecastMinuteStock(points,points.at(-1)!.timestamp+15,row.horizon);
  expect(row.forecast.predictedPrice).toBe(standalone.predictedPrice);
  expect(row.forecast.mae).toBe(standalone.mae);
  expect(row.forecast.observations).toBe(WEEK_MINUTES);
  expect(row.forecast.trainingSamples).toBeGreaterThan(9800);
  expect(row.forecast.points).toHaveLength(60);
  expect(row.forecast.validation.length).toBeLessThanOrEqual(20);
  expect(row.history_from).toBe(points[0].timestamp);
  expect(row.history_to).toBe(points.at(-1)!.timestamp);
 }
});
