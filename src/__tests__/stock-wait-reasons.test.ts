import {expect,it} from 'vitest';
import {stockDecision,type StockForecast} from '../lib/stock-forecast';
import {stockCardDecision,WAIT_LABELS} from '../lib/stock-card-decision';
const now=1794000000,at=new Date(now*1000).toISOString();
const base:StockForecast={points:[],last:{timestamp:now,price:100},cadence:60,targetTime:now+60,supported:true,lower:99.99,upper:100.03,predictedPrice:100.01,predictedReturn:.0001,tests:80,mae:.001,baselineMae:.002,directionAccuracy:.6,validation:[]};
it('explains no edge and each failed historical check without changing the gate',()=>{
 const baseline={...base,model:'No change',supported:false};
 expect(stockDecision(baseline,now).blocker).toBe('baseline');
 const weak={...base,model:'Ridge',supported:false,directionAccuracy:.44,mae:.0021};
 const decision=stockDecision(weak,now);
 expect(decision.signal).toBe('Wait');expect(decision.blocker).toBe('validation');
 expect(decision.reason).toContain('44.0%');expect(decision.reason).toContain('55%');expect(decision.reason).toContain('needs 5%');
});
it('explains tiny price moves, ownership gates and updates separately',()=>{
 const fees=stockCardDecision(base,at,now);expect(fees.blocker).toBe('fees');expect(fees.reason).toContain('+0.0100%');
 const sell={...base,predictedReturn:-.03,predictedPrice:97,lower:96,upper:98};
 expect(stockCardDecision(sell,at,now).blocker).toBe('ownership');
 expect(stockCardDecision(sell,at,now,{stock_id:'1',shares:10,avg_cost:95}).signal).toBe('Sell / rebuy watch');
 expect(stockCardDecision(base,new Date((now+60)*1000).toISOString(),now).blocker).toBe('updating');
 expect(stockCardDecision(undefined,at,now).blocker).toBe('data');
 expect(WAIT_LABELS.fees).toBe('Move too small after fees');
});
