import { describe,it,expect,vi,beforeEach,afterEach } from 'vitest';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { invokeTornData,cancelTornRequests } from '../lib/torn-data-client';
import { mergeObservation,observationsKey,isRecent,refreshAfter,nextRefreshPath } from '../lib/observation-cache';
import { observationKey,type TornObservation } from '../lib/personal-data';
import { CAPABILITIES } from '../api/capabilities';
import type { DataEntry } from '../lib/connected-data';
import HomeDashboard from '../components/HomeDashboard';
import MyTorn from '../components/MyTorn';
import LiveFeeds from '../pages/LiveFeeds';
const mocks=vi.hoisted(()=>({owner:'owner-a' as string|null,invoke:vi.fn(),read:vi.fn()}));
vi.mock('../lib/supabase',()=>({supabase:{auth:{getSession:async()=>({data:{session:mocks.owner?{user:{id:mocks.owner}}:null}})},functions:{invoke:(...args:any[])=>mocks.invoke(...args)},from:()=>({select:()=>{const chain:any={eq:()=>chain,maybeSingle:()=>mocks.read()};return chain;}})}}));
const now=1800000000000;
const endpoint=(path:string)=>CAPABILITIES.find(c=>c.path===path)!.id;
const sample=(path='/user/bars',at=now,parameters:Record<string,string>={}):TornObservation=>({endpoint_id:endpoint(path),parameters,payload:{bars:{energy:{current:40,maximum:100}}},fetched_at:new Date(at).toISOString(),cached:false,next_parameters:null});
const client=()=>new QueryClient({defaultOptions:{queries:{retry:false}}});
const opts=(path='/user/bars',parameters:Record<string,string>={},signal?:AbortSignal)=>({body:{endpoint_id:endpoint(path),parameters},signal});
const deferred=<T,>()=>{let resolve!:(v:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};};
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(now);mocks.owner='owner-a';mocks.invoke.mockReset();mocks.read.mockReset();mocks.read.mockResolvedValue({data:null,error:null});mocks.invoke.mockImplementation(async(_name:string,options:any)=>({data:{...sample(),endpoint_id:options.body.endpoint_id,parameters:options.body.parameters},error:null}));});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
describe('shared private observations',()=>{
 it('reuses a fresh response across tools without changing its collection time',async()=>{
  const cache=client();await invokeTornData(cache,opts());const second=await invokeTornData(cache,opts('/user/bars',{comment:' '}));
  expect(mocks.invoke).toHaveBeenCalledTimes(1);expect(second.data.cached).toBe(true);expect(second.data.fetched_at).toBe(new Date(now).toISOString());
 });
 it('fetches expired data and never treats future timestamps as fresh',async()=>{
  const cache=client(),observation=sample('/user/bars',now-61000);cache.setQueryData(observationsKey('owner-a'),mergeObservation({},observation));
  await invokeTornData(cache,opts());expect(mocks.invoke).toHaveBeenCalledTimes(1);expect(isRecent(sample('/user/bars',now+1),60000)).toBe(false);
 });
 it('shares simultaneous requests while keeping independent caller cancellation',async()=>{
  const cache=client(),gate=deferred<any>();mocks.invoke.mockReturnValue(gate.promise);
  const first=new AbortController(),second=new AbortController();
  const a=invokeTornData(cache,opts('/user/bars',{},first.signal)),b=invokeTornData(cache,opts('/user/bars',{},second.signal));
  const rejection=expect(a).rejects.toThrow('Cancelled');await vi.waitFor(()=>expect(mocks.invoke).toHaveBeenCalledTimes(1));first.abort();await rejection;
  expect(mocks.invoke.mock.calls[0][1].signal.aborted).toBe(false);gate.resolve({data:sample(),error:null});expect((await b).data.endpoint_id).toBe(endpoint('/user/bars'));
 });
 it('aborts the underlying request when its last consumer cancels and permits retry',async()=>{
  const cache=client(),gate=deferred<any>();mocks.invoke.mockReturnValueOnce(gate.promise);const controller=new AbortController();
  const request=invokeTornData(cache,opts('/user/bars',{},controller.signal)),rejection=expect(request).rejects.toThrow('Cancelled');
  await vi.waitFor(()=>expect(mocks.invoke).toHaveBeenCalledTimes(1));controller.abort();await rejection;
  expect(mocks.invoke.mock.calls[0][1].signal.aborted).toBe(true);gate.resolve({data:sample(),error:null});await Promise.resolve();
  await invokeTornData(cache,opts());expect(mocks.invoke).toHaveBeenCalledTimes(2);
 });
 it('does not cache errors and preserves the last successful snapshot',async()=>{
  const cache=client(),old=sample('/user/bars',now-61000);cache.setQueryData(observationsKey('owner-a'),mergeObservation({},old));
  mocks.invoke.mockResolvedValueOnce({data:{error:'Rate limited'},error:{context:{status:429}}});const failure=await invokeTornData(cache,opts());
  expect(failure.error.context.status).toBe(429);expect(cache.getQueryData<Record<string,DataEntry>>(observationsKey('owner-a'))?.[observationKey(old.endpoint_id,{})].observation).toEqual(old);
  await invokeTornData(cache,opts());expect(mocks.invoke).toHaveBeenCalledTimes(2);
 });
 it('isolates owners and rejects responses arriving after an account change',async()=>{
  const cache=client();await invokeTornData(cache,opts());mocks.owner='owner-b';await invokeTornData(cache,opts());expect(mocks.invoke).toHaveBeenCalledTimes(2);
  const gate=deferred<any>();mocks.invoke.mockReturnValueOnce(gate.promise);const request=invokeTornData(cache,opts('/user/travel')),rejection=expect(request).rejects.toThrow('Cancelled');await vi.waitFor(()=>expect(mocks.invoke).toHaveBeenCalledTimes(3));mocks.owner='owner-c';gate.resolve({data:sample('/user/travel'),error:null});await rejection;
  expect(cache.getQueryData(observationsKey('owner-c'))).toBeUndefined();
 });
 it('does not send anything without a session or for an already-aborted caller',async()=>{
  const cache=client();mocks.owner=null;await expect(invokeTornData(cache,opts())).rejects.toThrow('Sign in');mocks.owner='owner-a';const control=new AbortController();control.abort();await expect(invokeTornData(cache,opts('/user/bars',{},control.signal))).rejects.toThrow('Cancelled');expect(mocks.invoke).not.toHaveBeenCalled();
 });
 it('keeps parameterized pages independent and preserves pagination from actual responses',async()=>{
  const cache=client();mocks.invoke.mockImplementation(async(_name:string,options:any)=>({data:{...sample('/user/log',now,options.body.parameters),next_parameters:{to:'100'}},error:null}));
  const first=await invokeTornData(cache,opts('/user/log',{from:'10'}));await invokeTornData(cache,opts('/user/log',{from:'20'}));const reused=await invokeTornData(cache,opts('/user/log',{from:'10'}));expect(mocks.invoke).toHaveBeenCalledTimes(2);expect(reused.data.next_parameters).toEqual(first.data.next_parameters);
 });
 it('does not mistake a restored log page without pagination metadata for a complete cached response',async()=>{
  const cache=client(),row=sample('/user/log');cache.setQueryData(observationsKey('owner-a'),mergeObservation({},row,true));await invokeTornData(cache,opts('/user/log'));expect(mocks.invoke).toHaveBeenCalledTimes(1);
 });
 it('rechecks the private essential cache inside the browser lock and avoids a duplicate Torn call in another tab',async()=>{
  let tail=Promise.resolve();vi.stubGlobal('navigator',{locks:{request:vi.fn((_name:string,_options:any,run:()=>Promise<any>)=>{const next=tail.then(run);tail=next.then(()=>{});return next;})}});
  let saved:any=null;mocks.read.mockImplementation(async()=>({data:saved,error:null}));mocks.invoke.mockImplementation(async()=>{saved={payload:sample().payload,fetched_at:sample().fetched_at};return {data:sample(),error:null};});
  const a=client(),b=client();await Promise.all([invokeTornData(a,opts()),invokeTornData(b,opts())]);expect(mocks.invoke).toHaveBeenCalledTimes(1);expect(navigator.locks.request).toHaveBeenCalledTimes(2);
 });
 it('keeps raw keys out of query data and separates concurrent credentials',async()=>{
  const cache=client();await Promise.all(['AbCdEfGh12345678','12345678AbCdEfGh'].map(apiKey=>invokeTornData(cache,{body:{...opts().body,apiKey}})));
  expect(mocks.invoke).toHaveBeenCalledTimes(2);const saved=JSON.stringify(cache.getQueryCache().getAll().map(q=>({key:q.queryKey,data:q.state.data})));
  expect(saved).not.toContain('AbCdEfGh12345678');expect(saved).not.toContain('12345678AbCdEfGh');
 });
 it('cancels pending requests when private state is cleared',async()=>{
  const cache=client(),gate=deferred<any>();mocks.invoke.mockReturnValueOnce(gate.promise);const request=invokeTornData(cache,opts()),rejection=expect(request).rejects.toThrow('Cancelled');await vi.waitFor(()=>expect(mocks.invoke).toHaveBeenCalledTimes(1));cancelTornRequests(cache);gate.resolve({data:sample(),error:null});await rejection;expect(cache.getQueryData(observationsKey('owner-a'))).toBeUndefined();
 });
});
describe('freshness and economical update policy',()=>{
 it('retains the newest observation and a real prior value without resetting timestamps',()=>{
  const old=sample('/user/bars',now-1000),fresh={...sample(),payload:{bars:{energy:{current:45,maximum:100}}}};let rows=mergeObservation({},old);rows=mergeObservation(rows,fresh);rows=mergeObservation(rows,old);const row=rows[observationKey(old.endpoint_id,{})];expect(row.observation).toEqual(fresh);expect(row.previous).toEqual(old.payload);expect(mergeObservation(rows,fresh)[observationKey(old.endpoint_id,{})].previous).toEqual(old.payload);
 });
 it('bounds in-memory observations to 100 records',()=>{
  let rows={};for(let i=0;i<105;i++)rows=mergeObservation(rows,sample('/user/log',now+i,{from:String(i)}));expect(Object.keys(rows)).toHaveLength(100);expect(Object.keys(rows)).not.toContain(observationKey(endpoint('/user/log'),{from:'0'}));
 });
 it('never schedules hidden, offline or manual-mode refreshes',()=>{
  expect(nextRefreshPath({},'active',false,true)).toBeUndefined();expect(nextRefreshPath({},'active',true,false)).toBeUndefined();expect(nextRefreshPath({},'off',true,true)).toBeUndefined();expect(nextRefreshPath({},'active',true,true)).toBe('/user/bars');
 });
 it('gives slower-changing sections longer intervals and increases travel frequency during a flight',()=>{
  expect(refreshAfter('/user/profile','active')).toBe(900000);expect(refreshAfter('/user/bars','active')).toBe(60000);expect(refreshAfter('/user/bars','economy')).toBe(300000);expect(refreshAfter('/user/travel','active',{travel:{time_left:0}})).toBe(300000);expect(refreshAfter('/user/travel','active',{travel:{time_left:100}})).toBe(60000);
 });
 it('selects only stale sections while keeping fresh records untouched',()=>{
  let rows={};for(const path of ['/user/bars','/user/cooldowns','/user/travel','/user/profile'])rows=mergeObservation(rows,sample(path));expect(nextRefreshPath(rows,'active',true,true)).toBeUndefined();rows=mergeObservation(rows,sample('/user/bars',now+61000));expect(nextRefreshPath(rows,'active',true,true,now+61000)).toBe('/user/cooldowns');
 });
 it('shows refresh controls and stale labels without fetching on render',()=>{
  const html=renderToStaticMarkup(<HomeDashboard entries={mergeObservation({},sample('/user/bars',now-61000))} onRefresh={()=>{}}/>);expect(html).toContain('needs refresh');expect(html).toContain('Refresh bars');expect(html).toContain('Refresh cooldowns');expect(mocks.invoke).not.toHaveBeenCalled();
 });
 it('renders saved dashboard cards before refresh controls and offers dropdown update modes',()=>{
  vi.stubGlobal('location',{hash:'#Overview'});const cache=client();cache.setQueryData(observationsKey('owner-a'),mergeObservation({},sample()));const html=renderToStaticMarkup(<QueryClientProvider client={cache}><MyTorn accountId="owner-a"/></QueryClientProvider>);expect(html.indexOf('Your daily overview')).toBeLessThan(html.indexOf('<h3>Refresh essentials'));expect(html).toContain('40 / 100');expect(html).toContain('Automatic updates');expect(html).toContain('Only essentials that need updating');expect(mocks.invoke).not.toHaveBeenCalled();
 });
 it('opens saved data browser observations without asking Torn again',()=>{
  vi.stubGlobal('location',{hash:'#Live Feeds?section=v2-user-profile'});const cache=client();cache.setQueryData(['observation-owner'],'owner-a');cache.setQueryData(observationsKey('owner-a'),mergeObservation({},sample('/user/profile')));const html=renderToStaticMarkup(<QueryClientProvider client={cache}><LiveFeeds/></QueryClientProvider>);expect(html).toContain('Official Torn observation');expect(mocks.invoke).not.toHaveBeenCalled();
 });
});
