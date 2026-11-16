import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {renderToStaticMarkup} from 'react-dom/server';
import MinuteStockLab from '../components/MinuteStockLab';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),single:vi.fn(),download:vi.fn(),workers:[] as any[]}));
vi.mock('../lib/supabase',()=>({supabase:{from:()=>({select:()=>({eq:()=>({single:mocks.single})})}),rpc:mocks.rpc}}));
vi.mock('../lib/export',()=>({downloadBlob:mocks.download}));
vi.mock('../components/StockForecast',()=>({ForecastDetails:()=>null}));
let root:ReactTestRenderer|undefined,client:QueryClient;
beforeEach(()=>{
 mocks.rpc.mockReset().mockResolvedValue({data:[{timestamp:1794833400,price:100.25}],error:null});
 mocks.single.mockReset().mockResolvedValue({data:{provider_at:'2026-11-16T12:50:00Z',last_attempt:null,last_success:null,rows_written:35,backfilled_stocks:1,message:'Minute collection active'},error:null});mocks.download.mockReset();mocks.workers=[];
 vi.stubGlobal('Worker',class{onmessage:any;onerror:any;postMessage=vi.fn();terminate=vi.fn();constructor(){mocks.workers.push(this);}});
 client=new QueryClient({defaultOptions:{queries:{retry:false}}});
});
afterEach(()=>{act(()=>root?.unmount());root=undefined;client.clear();vi.unstubAllGlobals();});
describe('shared minute lab',()=>{
 it('makes the data source, archive limit and spreadsheet export clear before any model is ready',()=>{
  const html=renderToStaticMarkup(<QueryClientProvider client={client}><MinuteStockLab/></QueryClientProvider>);
  expect(html).toContain('30 days online');expect(html).toContain('Tornsy');expect(html).toContain('Download loaded minute prices (CSV)');expect(html).toContain('not guaranteed');expect(html).toContain('Forecast ahead');
 });
 it('trains in a worker and terminates it when leaving the screen',async()=>{
  await act(async()=>{root=create(<QueryClientProvider client={client}><MinuteStockLab/></QueryClientProvider>);await new Promise(r=>setTimeout(r,40));});
  await act(async()=>{await new Promise(r=>setTimeout(r,40));});
  expect(mocks.rpc).toHaveBeenCalledWith('read_stock_minute_history',{p_stock_id:2});
  expect(mocks.workers).toHaveLength(1);expect(mocks.workers[0].postMessage).toHaveBeenCalledWith(expect.objectContaining({horizon:1,points:[{timestamp:1794833400,price:100.25}]}));
  act(()=>root!.unmount());root=undefined;expect(mocks.workers[0].terminate).toHaveBeenCalled();
 });
});
