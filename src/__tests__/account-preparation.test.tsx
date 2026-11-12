import {isTimerEndpoint} from '../../supabase/functions/_shared/timer-events';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {renderToStaticMarkup} from 'react-dom/server';
import {preparationPlan,startPreparation,pageDatasets,PAGE_DATA,PREPARATION_CALLS} from '../lib/account-preparation';
import {compileTornRequest} from '../../supabase/functions/_shared/torn-data';
import {observationKey} from '../lib/personal-data';
import {observationsKey,mergeObservation} from '../lib/observation-cache';
import AccountPreparation,{preparationKey} from '../components/AccountPreparation';
import TornDataShortcut from '../components/TornDataShortcut';
import {useTornKeyMode} from '../hooks/useTornKeyMode';
const mocks=vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock('../lib/supabase',()=>({supabase:{}}));
vi.mock('../lib/torn-data-client',()=>({invokeTornData:(...args:unknown[])=>mocks.invoke(...args)}));
let root:ReactTestRenderer|undefined;
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(1800000000000);});
afterEach(()=>{act(()=>root?.unmount());root=undefined;vi.useRealTimers();vi.unstubAllGlobals();mocks.invoke.mockReset();});
describe('one minute preparation request plan',()=>{
 it('contains exactly 95 unique, compilable requests, with essential tools first',()=>{
  const rows=preparationPlan();expect(rows).toHaveLength(PREPARATION_CALLS);
  expect(new Set(rows.map(row=>observationKey(row.capability.id,row.parameters))).size).toBe(95);
  for(const row of rows)expect(()=>compileTornRequest(row.capability.id,row.parameters)).not.toThrow();
  expect(rows.slice(0,4).map(row=>row.capability.path)).toEqual(['/user/profile','/user/bars','/user/cooldowns','/user/travel']);
  for(const page of Object.keys(PAGE_DATA)){expect(pageDatasets(page).length).toBe(PAGE_DATA[page].length);for(const endpoint of pageDatasets(page))expect(rows.some(row=>row.capability.id===endpoint.id),page+': '+endpoint.path).toBe(true);}
 });
 it('paces exactly 95 calls, never opens early, and finishes at 60,000ms',async()=>{
  const start=Date.now(),times:number[]=[],done=vi.fn();
  const task=startPreparation({fetch:async()=>{times.push(Date.now()-start);return {ok:true};},onProgress:()=>{},onComplete:done});
  await vi.advanceTimersByTimeAsync(59999);expect(times).toHaveLength(95);expect(done).not.toHaveBeenCalled();
  expect(times[0]).toBe(0);for(let i=1;i<times.length;i++)expect(times[i]-times[i-1]).toBeGreaterThanOrEqual(600);
  await vi.advanceTimersByTimeAsync(1);expect(done).toHaveBeenCalledWith(expect.objectContaining({loaded:95,failed:0,started:95,finishedAt:start+60000}));task.cancel();
 });
 it('caps concurrency and aborts slow work at the fixed deadline',async()=>{
  const signals:AbortSignal[]=[],done=vi.fn();startPreparation({fetch:(_row,signal)=>{signals.push(signal);return new Promise(()=>{});},onProgress:()=>{},onComplete:done});
  await vi.advanceTimersByTimeAsync(60000);expect(signals).toHaveLength(5);expect(signals.every(signal=>signal.aborted)).toBe(true);expect(done.mock.calls[0][0]).toMatchObject({loaded:0,started:5,active:0});
 });
 it('continues after a permission failure, without inflating the 95-call budget',async()=>{
  let calls=0;const done=vi.fn();startPreparation({fetch:async()=>({ok:++calls!==3}),onProgress:()=>{},onComplete:done});await vi.advanceTimersByTimeAsync(60000);
  expect(calls).toBe(95);expect(done.mock.calls[0][0]).toMatchObject({loaded:94,failed:1});
 });
 it('stops issuing requests after auth or rate-limit errors but retains the exact countdown',async()=>{
  const fetch=vi.fn(async()=>({ok:false,fatal:true,error:'Request limit reached'})),done=vi.fn();startPreparation({fetch,onProgress:()=>{},onComplete:done});
  await vi.advanceTimersByTimeAsync(59999);expect(fetch).toHaveBeenCalledTimes(1);expect(done).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);expect(done.mock.calls[0][0].problem).toContain('Request limit');
 });
 it('does not continue or complete after a logout/unmount cancellation',async()=>{
  const fetch=vi.fn(async()=>({ok:true})),done=vi.fn(),task=startPreparation({fetch,onProgress:()=>{},onComplete:done});task.cancel();await vi.advanceTimersByTimeAsync(60000);expect(fetch).toHaveBeenCalledTimes(1);expect(done).not.toHaveBeenCalled();
 });
});
const owner='prep-owner';
function client(){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});client.setQueryData(['observation-owner'],owner);client.setQueryData(observationsKey(owner),{});return client;}
describe('loading screen and data shared across tools',()=>{
 it('shows 01:00, rotating messages, then a tick and the workspace after one minute',async()=>{
  const cache=client();mocks.invoke.mockImplementation(async(_client,{body})=>({data:{endpoint_id:body.endpoint_id,parameters:body.parameters,payload:{},fetched_at:new Date().toISOString(),next_parameters:null},error:null}));
  await act(async()=>{root=create(<QueryClientProvider client={cache}><AccountPreparation owner={owner}><div>Workspace content</div></AccountPreparation></QueryClientProvider>);await vi.advanceTimersByTimeAsync(0);});
  expect(root!.root.findByProps({role:'timer'}).children.join('')).toBe('01:00');expect(JSON.stringify(root!.toJSON())).not.toContain('Workspace content');
  await act(async()=>{await vi.advanceTimersByTimeAsync(59999);});expect(JSON.stringify(root!.toJSON())).not.toContain('Workspace content');
  await act(async()=>{await vi.advanceTimersByTimeAsync(1);});expect(JSON.stringify(root!.toJSON())).toContain('You’re ready now');expect(mocks.invoke).toHaveBeenCalledTimes(95);expect(cache.getQueryData(preparationKey(owner))).toMatchObject({loaded:95});
  for(const [,options] of mocks.invoke.mock.calls){expect(options.body.refresh).toBe(!isTimerEndpoint(options.body.endpoint_id));expect(options.body).not.toHaveProperty('apiKey');}
  vi.stubGlobal('requestAnimationFrame',(callback:()=>void)=>callback());vi.stubGlobal('document',{getElementById:()=>null});
  await act(async()=>{await vi.advanceTimersByTimeAsync(1200);});expect(JSON.stringify(root!.toJSON())).toContain('Workspace content');
 });
 it('skips private preparation for shared reports and does not reuse another owner’s completion',()=>{
  const cache=client();cache.setQueryData(preparationKey('other-owner'),{loaded:95});
  const render=(id:string)=>renderToStaticMarkup(<QueryClientProvider client={cache}><AccountPreparation owner={id}>Published report</AccountPreparation></QueryClientProvider>);
  expect(render('')).toContain('Published report');expect(render(owner)).not.toContain('Published report');expect(mocks.invoke).not.toHaveBeenCalled();
 });
 it('displays the collected official data on its tool page without another request',()=>{
  const cache=client(),row=preparationPlan().find(row=>row.capability.path==='/user/stocks')!;
  cache.setQueryData(observationsKey(owner),mergeObservation({},{endpoint_id:row.capability.id,parameters:row.parameters,payload:{stocks:[{id:1,name:'My test holding',shares:42}]},fetched_at:new Date().toISOString(),next_parameters:null}));
  const html=renderToStaticMarkup(<QueryClientProvider client={cache}><TornDataShortcut page="Stocks"/></QueryClientProvider>);
  expect(html).toContain('My test holding');expect(html).toContain('Observed');expect(html).toContain('Loaded');expect(mocks.invoke).not.toHaveBeenCalled();
 });
 it('uses the saved key automatically and preserves an explicit key choice',async()=>{
  const cache=client();cache.setQueryData(['torn-connection',owner],{hasStoredKey:true,identity:null});let choose!:(mode:string)=>void;
  function Probe(){const [mode,setMode]=useTornKeyMode();choose=setMode;return <span>{mode}</span>;}
  await act(async()=>{root=create(<QueryClientProvider client={cache}><Probe/></QueryClientProvider>);});expect(JSON.stringify(root!.toJSON())).toContain('stored');
  await act(async()=>choose('request'));expect(JSON.stringify(root!.toJSON())).toContain('request');
 });
});
