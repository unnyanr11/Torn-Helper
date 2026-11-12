import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {renderToStaticMarkup} from 'react-dom/server';
import StockForecast,{ForecastDetails} from '../components/StockForecast';
import {forecastStock,HISTORY_ENDPOINT} from '../lib/stock-forecast';
const mocks=vi.hoisted(()=>({invoke:vi.fn(),owner:'stock-owner' as string|null}));
vi.mock('../lib/supabase',()=>({supabase:{}}));
vi.mock('../hooks/useSavedObservations',()=>({useCurrentObservations:()=>({owner:mocks.owner,data:{}})}));
vi.mock('../lib/torn-data-client',()=>({invokeTornData:(...args:unknown[])=>mocks.invoke(...args)}));
let root:ReactTestRenderer|undefined;
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(1795000000000);mocks.owner='stock-owner';mocks.invoke.mockReset();});
afterEach(()=>{act(()=>root?.unmount());root=undefined;vi.useRealTimers();});
function mount(){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});act(()=>{root=create(<QueryClientProvider client={client}><StockForecast/></QueryClientProvider>);});return client;}
const buttons=()=>root!.root.findAllByType('button');
describe('stock timing lab',()=>{
 it('shows an honest empty state without automatically fetching histories, even while the local clock updates',async()=>{
  mount();expect(JSON.stringify(root!.toJSON())).toContain('No forecast yet');
  await act(async()=>{await vi.advanceTimersByTimeAsync(120000);});
  expect(mocks.invoke).not.toHaveBeenCalled();
 });
 it('requests only selected stock history on deliberate refresh using the stored-key proxy',async()=>{
  mocks.invoke.mockResolvedValue({data:{endpoint_id:HISTORY_ENDPOINT,payload:{stocks:{id:2,chart:{history:[]}}}},error:null});
  mount();await act(async()=>{buttons().find(b=>b.children.includes('Analyse / refresh selected'))!.props.onClick();});
  expect(mocks.invoke).toHaveBeenCalledTimes(1);
  const options=mocks.invoke.mock.calls[0][1];
  expect(options.body).toEqual({endpoint_id:HISTORY_ENDPOINT,parameters:{stockId:'2'},refresh:true});
  expect(options.signal).toBeInstanceOf(AbortSignal);
  expect(JSON.stringify(root!.toJSON())).toContain('Analysis complete');
 });
 it('cancels the pending request when leaving the page',async()=>{
  let signal:AbortSignal|undefined;
  mocks.invoke.mockImplementation((_client,options)=>{signal=options.signal;return new Promise(()=>{});});
  mount();await act(async()=>{buttons().find(b=>b.children.includes('Analyse / refresh selected'))!.props.onClick();});
  expect(signal?.aborted).toBe(false);act(()=>root!.unmount());expect(signal?.aborted).toBe(true);root=undefined;
 });
 it('disables collection when signed out',()=>{
  mocks.owner=null;mount();
  expect(buttons().filter(b=>b.children.includes('Compare all 35 stocks')||b.children.includes('Analyse / refresh selected')).every(b=>b.props.disabled)).toBe(true);
 });
 it('renders supported and expired forecasts with price windows and transparent evidence',()=>{
  const points=Array.from({length:120},(_,i)=>({timestamp:1794000000+i*3600,price:100*1.004**i})),forecast=forecastStock(points);
  const active=renderToStaticMarkup(<ForecastDetails forecast={forecast} id={2} now={points[119].timestamp+30}/>);
  expect(active).toContain('Buy candidate');expect(active).toContain('Entry ceiling');expect(active).toContain('walk-forward tests');expect(active).toContain('Historical error range');expect(active).toContain('Torn City Investments');
  const expired=renderToStaticMarkup(<ForecastDetails forecast={forecast} id={2} now={forecast.targetTime}/>);
  expect(expired).toContain('Wait');expect(expired).toContain('forecast window has passed');expect(expired).not.toContain('Entry ceiling');
 });
});
