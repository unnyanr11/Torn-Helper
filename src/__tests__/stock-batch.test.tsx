import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {mergeStockBatch} from '../lib/stock-batch';
import StockAdvice from '../components/StockAdvice';
import {forecastMinuteStock} from '../lib/minute-forecast';
it('merges a single batch across stocks and retains previous points on incremental updates',()=>{
 const first=mergeStockBatch(undefined,{provider_at:'2026-11-19T12:00:00Z',backfilled_stocks:35,stocks:{'1':[[1795089540,100]],'2':[[1795089540,200]]}},true);
 const second=mergeStockBatch(first,{provider_at:'2026-11-19T12:01:00Z',backfilled_stocks:35,stocks:{'1':[[1795089600,101]],'2':[[1795089600,201]]}},false);
 expect(second.stocks['1'].map(p=>p.price)).toEqual([100,101]);
 expect(second.stocks['2'].map(p=>p.price)).toEqual([200,201]);
 expect(Object.keys(second.stocks)).toHaveLength(35);
});
it('shows Wait for incomplete analysis and for an expired forecast',()=>{
 const empty=renderToStaticMarkup(<StockAdvice now={1795089600} training/>);
 expect(empty).toContain('Wait');expect(empty).toContain('Analysis is running');
 const forecast=forecastMinuteStock([],1795089600,1);
 const html=renderToStaticMarkup(<StockAdvice forecast={forecast} now={1795089600}/>);
 expect(html).toContain('Wait');expect(html).not.toContain('Consider buying');
});
it('explains actionable price levels and returns to Wait when minute data is stale',()=>{
 const now=1795089600;
 const base={...forecastMinuteStock([],now,1),issue:undefined,last:{timestamp:now,price:100},dip:{present:true,dropReturn:-.01,tests:30,reboundRate:.6},supported:true,targetTime:now+3600,lower:102,upper:104,predictedPrice:103};
 const buy=renderToStaticMarkup(<StockAdvice forecast={base} now={now}/>);
 expect(buy).toContain('Buy');expect(buy).toContain('$101.90');
 const sell=renderToStaticMarkup(<StockAdvice holding={{stock_id:"2",shares:100,avg_cost:95}} forecast={{...base,lower:96,upper:98,predictedPrice:97}} now={now}/>);
 expect(sell).toContain('Sell');expect(sell).toContain('$99.90');expect(sell).toContain('already own');
 const stale=renderToStaticMarkup(<StockAdvice forecast={base} now={now+121}/>);
 expect(stale).toContain('Wait');expect(stale).toContain('Prices are outdated');
});
