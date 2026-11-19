import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {renderToStaticMarkup} from 'react-dom/server';
import {forecastMinuteStock} from '../lib/minute-forecast';
import MinuteStockLab from '../components/MinuteStockLab';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),single:vi.fn(),download:vi.fn(),workers:[] as any[],analyses:vi.fn()}));
vi.mock('../lib/supabase',()=>({supabase:{channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:vi.fn(),from:()=>({select:()=>({order:mocks.analyses,eq:()=>({single:mocks.single,order:async()=>({data:[],error:null})})})}),rpc:mocks.rpc}}));
vi.mock('../lib/export',()=>({downloadBlob:mocks.download}));
vi.mock('../components/StockForecast',()=>({ForecastDetails:()=>null}));
let root:ReactTestRenderer|undefined,client:QueryClient;
beforeEach(()=>{
 mocks.rpc.mockReset().mockResolvedValue({data:{points:[],provider_at:'2026-11-16T12:50:00Z',backfilled_stocks:1,stocks:{'2':[[1794833400,100.25]]}},error:null});
 mocks.single.mockReset().mockResolvedValue({data:{provider_at:'2026-11-16T12:50:00Z',last_attempt:null,last_success:null,rows_written:35,backfilled_stocks:1,message:'Minute collection active'},error:null});mocks.download.mockReset();mocks.workers=[];
 vi.stubGlobal('Worker',class{onmessage:any;onerror:any;postMessage=vi.fn();terminate=vi.fn();constructor(){mocks.workers.push(this);}});
 const timestamp=Math.floor(Date.now()/60000)*60;
 const forecast={...forecastMinuteStock([],timestamp+15,1),last:{timestamp,price:100.25},targetTime:timestamp+60,observations:10080};
 mocks.analyses.mockResolvedValue({data:[{stock_id:2,horizon:1,provider_at:new Date(timestamp*1000).toISOString(),computed_at:new Date().toISOString(),forecast,processing_ms:12,history_from:new Date((timestamp-604800)*1000).toISOString(),history_to:new Date(timestamp*1000).toISOString()}],error:null});
 client=new QueryClient({defaultOptions:{queries:{retry:false}}});
});
afterEach(()=>{act(()=>root?.unmount());root=undefined;client.clear();vi.unstubAllGlobals();});
describe('shared minute lab',()=>{
 it('makes the data source, archive limit and spreadsheet export clear before any model is ready',()=>{
  const html=renderToStaticMarkup(<QueryClientProvider client={client}><MinuteStockLab/></QueryClientProvider>);
  expect(html).toContain('30 days online');expect(html).toContain('Tornsy');expect(html).toContain('spreadsheet export');expect(html).toContain('not guaranteed');expect(html).toContain('Forecast ahead');expect(html).toContain('prices collected before you signed in');expect(html).not.toContain('Forward score during this open page session');
 });
 it('loads saved server results without a worker or weekly history download',async()=>{
  await act(async()=>{root=create(<QueryClientProvider client={client}><MinuteStockLab/></QueryClientProvider>);await new Promise(r=>setTimeout(r,40));});
  await act(async()=>{await new Promise(r=>setTimeout(r,40));});
  expect(mocks.workers).toHaveLength(0);
  expect(mocks.rpc.mock.calls.every(call=>call[0]==='read_stock_chart_history')).toBe(true);
  expect(JSON.stringify(root!.toJSON())).toContain('Analysed on the server');
  await act(async()=>{root!.root.findByProps({label:'Minute stock'}).props.onChange({target:{value:'3'}});});
  expect(mocks.workers).toHaveLength(0);expect(mocks.rpc.mock.calls.every(call=>call[0]==='read_stock_chart_history')).toBe(true);
 });
});
