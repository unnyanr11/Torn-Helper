import {expect,it} from 'vitest';
import {cleanLongTermHistory,forecastLongTermStock,longTermStockDecision,type LongTermForecast} from '../lib/long-term-stock';
const start=1790000000-startOffset();function startOffset(){return 1790000000%3600;}
const points=Array.from({length:720},(_,i)=>({timestamp:start+i*3600+3540,price:100+i*.02}));
const now=points.at(-1)!.timestamp+20;
function forecast(direction=1):LongTermForecast{
 const f=forecastLongTermStock(points),price=f.last!.price;
 return {...f,supported:true,issue:undefined,model:'Test validated model',predictedPrice:price*(1+.02*direction),predictedReturn:.02*direction,lower:price*(1+.02*direction-.002),upper:price*(1+.02*direction+.002),dip:{present:true,dropReturn:-.01,tests:50,reboundRate:.7},mean24h:price*1.01};
}
it('uses a month of data with separate historical checks and a 24-hour forecast',()=>{
 const f=forecastLongTermStock(points);
 expect(f.historyDays).toBeGreaterThan(29.9);expect(f.change30d).not.toBeNull();expect(f.targetTime).toBe(f.last!.timestamp+86400);expect(f.tests).toBeGreaterThan(24);expect(f.directionAccuracy).toBe(1);expect(f.supported).toBe(true);expect(f.model).not.toBe('No change');
});
it('labels partial history and blocks insufficient or invalid history',()=>{
 expect(forecastLongTermStock(points.slice(-240)).change30d).toBeNull();
 expect(forecastLongTermStock(points.slice(-24)).issue).toContain('seven days');
 expect(forecastLongTermStock([{timestamp:NaN,price:10},{timestamp:100,price:0}]).last).toBeNull();
});
it('keeps future neighbours out of an earlier gap and does not invent leading days',()=>{
 const clean=cleanLongTermHistory([points[0],points[3]]);
 expect(clean).toHaveLength(4);expect(clean[1]).toMatchObject({estimated:true,availableAt:points[3].timestamp,price:(points[0].price+points[3].price)/2});expect(clean[0]).toEqual(points[0]);
 const before=forecastLongTermStock(points.slice(0,500));
 const changed=forecastLongTermStock(points.slice(0,500).map((p,i)=>i>480?{...p,price:p.price*1.2}:p));
 expect(changed.validation.filter(v=>v.timestamp<points[480].timestamp)).toEqual(before.validation.filter(v=>v.timestamp<points[480].timestamp));
});
it('shows Buy or Wait without shares and Hold only with a positive holding',()=>{
 const f=forecast();
 expect(longTermStockDecision(f,now).signal).toBe('Buy candidate');
 expect(longTermStockDecision(f,now,{stock_id:'1',shares:10,avg_cost:100}).signal).toBe('Hold');
 expect(longTermStockDecision(f,now,{stock_id:'1',shares:0,avg_cost:100}).signal).toBe('Buy candidate');
 expect(longTermStockDecision({...f,dip:{...f.dip!,present:false}},now).signal).toBe('Wait');
 expect(longTermStockDecision({...f,supported:false},now,{stock_id:'1',shares:10,avg_cost:100}).signal).toBe('Wait');
});
it('allows Sell only for owned shares and strictly above 0.1% profit after fees',()=>{
 const f=forecast(-1),price=f.last!.price;
 expect(longTermStockDecision(f,now).signal).toBe('Wait');
 expect(longTermStockDecision(f,now,{stock_id:'1',shares:10,avg_cost:null}).blocker).toBe('cost');
 expect(longTermStockDecision(f,now,{stock_id:'1',shares:10,avg_cost:price*.999/1.001}).signal).toBe('Hold');
 expect(longTermStockDecision(f,now,{stock_id:'1',shares:10,avg_cost:price*.999/1.0011}).signal).toBe('Sell / rebuy watch');
 expect(longTermStockDecision(f,now,{stock_id:'1',shares:-1,avg_cost:1}).signal).toBe('Wait');
});
it('uses fresh quotes for profit and blocks stale prices or expired cached results',()=>{
 const f=forecast(-1);
 expect(longTermStockDecision(f,now+601).blocker).toBe('stale');
 expect(longTermStockDecision(f,now+300,undefined,{timestamp:now-1000,price:100}).blocker).toBe('stale');
 expect(longTermStockDecision(f,now,{stock_id:'1',shares:10,avg_cost:110},{timestamp:now,price:109}).signal).toBe('Hold');
 expect(longTermStockDecision({...f,predictedPrice:NaN},now).signal).toBe('Wait');
});
