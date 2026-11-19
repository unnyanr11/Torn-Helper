import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {renderToStaticMarkup} from 'react-dom/server';
import {forecastLongTermStock} from '../lib/long-term-stock';
import MinuteStockLab from '../components/MinuteStockLab';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),single:vi.fn(),download:vi.fn(),workers:[] as any[],analyses:vi.fn(),longAnalyses:vi.fn()}));
vi.mock('../lib/supabase',()=>({supabase:{channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:vi.fn(),from:(table:string)=>({select:()=>({order:table==='stock_long_term_results'?mocks.longAnalyses:mocks.analyses,eq:()=>({single:mocks.single,order:async()=>({data:[{stock_id:2,price:107.19,source:'Torn',observed_at:new Date(Math.floor(Date.now()/60000)*60000).toISOString()}],error:null})})})}),rpc:mocks.rpc}}));
vi.mock('../lib/export',()=>({downloadBlob:mocks.download}));
vi.mock('../components/StockForecast',()=>({ForecastDetails:()=>null}));
let root:ReactTestRenderer|undefined,client:QueryClient;
beforeEach(()=>{
 vi.stubGlobal('document',{documentElement:{dataset:{motion:'reduced'}}});
 mocks.rpc.mockReset().mockResolvedValue({data:{points:[],provider_at:'2026-11-16T12:50:00Z',backfilled_stocks:1,stocks:{'2':[[1794833400,100.25]]}},error:null});
 mocks.single.mockReset().mockResolvedValue({data:{provider_at:'2026-11-16T12:50:00Z',last_attempt:null,last_success:null,rows_written:35,backfilled_stocks:1,message:'Minute collection active'},error:null});mocks.download.mockReset();mocks.workers=[];
 vi.stubGlobal('Worker',class{onmessage:any;onerror:any;postMessage=vi.fn();terminate=vi.fn();constructor(){mocks.workers.push(this);}});
 const timestamp=Math.floor(Date.now()/60000)*60;
 const forecast=forecastLongTermStock(Array.from({length:168},(_,i)=>({timestamp:timestamp-(167-i)*3600,price:100+i*.01})),1,7);
 mocks.longAnalyses.mockReset().mockResolvedValue({data:[],error:null});
 mocks.analyses.mockResolvedValue({data:[{stock_id:2,horizon_hours:1,provider_at:new Date(timestamp*1000).toISOString(),computed_at:new Date().toISOString(),forecast,processing_ms:12,batch_ms:100,history_from:new Date((timestamp-604800)*1000).toISOString(),history_to:new Date(timestamp*1000).toISOString()}],error:null});
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
  expect(mocks.rpc.mock.calls.every(call=>['read_stock_chart_history','read_stock_window_openings'].includes(call[0]))).toBe(true);
  expect(JSON.stringify(root!.toJSON())).toContain('Backend batch: 35 stocks');
  await act(async()=>{root!.root.findByProps({label:'Stock'}).props.onChange({target:{value:'3'}});});
  expect(mocks.workers).toHaveLength(0);expect(mocks.rpc.mock.calls.every(call=>['read_stock_chart_history','read_stock_window_openings'].includes(call[0]))).toBe(true);
 });
 it('switches to cached long-term results and shows Hold for an owned stock',async()=>{
  const stamp=Math.floor(Date.now()/60000)*60;
  const long=forecastLongTermStock(Array.from({length:720},(_,i)=>({timestamp:stamp-(719-i)*3600,price:100+i*.01})),168,120);
  mocks.analyses.mockResolvedValue({data:[{stock_id:2,horizon_hours:168,provider_at:new Date(stamp*1000).toISOString(),computed_at:new Date().toISOString(),batch_ms:100,forecast:{...long,supported:true,predictedPrice:long.last!.price*1.02,lower:long.last!.price*1.019,upper:long.last!.price*1.021}}],error:null});
  await act(async()=>{root=create(<QueryClientProvider client={client}><MinuteStockLab holdings={[{stock_id:'2',shares:10,avg_cost:90}]}/></QueryClientProvider>);});
  await act(async()=>root!.root.findByProps({'aria-label':'Trading style'}).props.onChange({target:{value:'long'}}));
  await act(async()=>{await new Promise(r=>setTimeout(r,40));});
  expect(root!.root.findAllByType('h4').some(n=>n.children.join('').includes('Suggested long-term action'))).toBe(true);
  expect(root!.root.findAllByType('strong').some(n=>n.children.includes('Hold'))).toBe(true);
  expect(mocks.workers).toHaveLength(0);
 });

 it('offers only the requested horizons and keeps each mode’s selected forecast',async()=>{
  await act(async()=>{root=create(<QueryClientProvider client={client}><MinuteStockLab/></QueryClientProvider>);});
  const selector=()=>root!.root.findByProps({'aria-label':'Forecast ahead'});
  expect(selector().findAllByType('option').map(n=>n.props.value)).toEqual([1,3,6,12,18,24]);
  await act(async()=>selector().props.onChange({target:{value:'12'}}));expect(selector().props.value).toBe(12);
  await act(async()=>root!.root.findByProps({'aria-label':'Trading style'}).props.onChange({target:{value:'long'}}));
  expect(selector().findAllByType('option').map(n=>n.props.value)).toEqual([168,336,504,672]);
  await act(async()=>selector().props.onChange({target:{value:'672'}}));expect(selector().props.value).toBe(672);
  await act(async()=>root!.root.findByProps({'aria-label':'Trading style'}).props.onChange({target:{value:'short'}}));expect(selector().props.value).toBe(12);
 });

 it('labels a shorter chart preview explicitly while retaining the unavailable long-term decision',async()=>{
  const stamp=Math.floor(Date.now()/60000)*60,points=Array.from({length:240},(_,i)=>({timestamp:stamp-(239-i)*3600,price:100+i*.01}));
  const daily=forecastLongTermStock(points,24,30),weekly={...forecastLongTermStock(points,168,120),issue:'Not enough completed 7 days outcomes.'};
  mocks.analyses.mockResolvedValue({data:[{stock_id:2,horizon_hours:24,forecast:daily,computed_at:'test',batch_ms:100},{stock_id:2,horizon_hours:168,forecast:weekly,computed_at:'test',batch_ms:100}],error:null});
  await act(async()=>{root=create(<QueryClientProvider client={client}><MinuteStockLab holdings={[{stock_id:'2',shares:10,avg_cost:90}]}/></QueryClientProvider>);});
  await act(async()=>root!.root.findByProps({'aria-label':'Trading style'}).props.onChange({target:{value:'long'}}));
  await act(async()=>{await new Promise(r=>setTimeout(r,40));});
  expect(JSON.stringify(root!.toJSON())).toContain('forecast unavailable');
  const notice=root!.root.findByProps({className:'stock-forecast-unavailable'});
  expect(notice.findAllByType('b').some(n=>n.children.includes('24-hour preview'))).toBe(true);
  expect(root!.root.findAllByProps({className:'stock-advice advice-wait'})).toHaveLength(1);
  expect(notice.findByType('input').props.checked).toBe(true);
  await act(async()=>notice.findByType('input').props.onChange({target:{checked:false}}));
  expect(notice.findByType('input').props.checked).toBe(false);
 });

});
