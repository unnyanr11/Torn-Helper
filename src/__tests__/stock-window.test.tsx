import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {stockWindowPosition,stockWindowLabel,type StockWindowExtreme} from '../lib/stock-window';
import StockWindowRange from '../components/StockWindowRange';
const range:StockWindowExtreme={stock_id:1,low:100,high:120,low_at:'2026-11-19T01:00:00Z',high_at:'2026-11-19T10:00:00Z',observed_points:1440,first_observed_at:'2026-11-19T00:00:00Z'};
it('compares current prices with the recorded extremes rather than the previous page update',()=>{
 expect(stockWindowPosition(110,range)).toEqual({aboveLow:expect.closeTo(10),belowHigh:expect.closeTo(100/12),position:50});
 expect(stockWindowPosition(100,range)?.position).toBe(0);expect(stockWindowPosition(120,range)?.position).toBe(100);
 expect(stockWindowPosition(100,{...range,high:100})?.position).toBeNull();
 expect(stockWindowPosition(100,{...range,low:0})).toBeNull();
});
it('shows high/low prices, exact timestamp attributes and the selected comparison label',()=>{
 const html=renderToStaticMarkup(<StockWindowRange current={110} range={range} minutes={1440}/>);
 expect(html).toContain('Recorded 24 hr range');expect(html).toContain('Low $100.00');expect(html).toContain('High $120.00');expect(html).toContain(range.low_at);expect(html).toContain(range.high_at);expect(html).toContain('aria-valuenow="50"');
 expect(stockWindowLabel(10080)).toBe('7 days');expect(stockWindowLabel(15)).toBe('15 min');
});
