import {afterEach,describe,expect,it,vi} from 'vitest';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import MyTorn from '../components/MyTorn';
import {observationsKey,mergeObservation} from '../lib/observation-cache';
import {CAPABILITIES} from '../api/capabilities';
import {ESSENTIAL_PATHS} from '../lib/home-dashboard';
const mock=vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock('../lib/torn-data-client',()=>({invokeTornData:mock.invoke}));
vi.mock('../lib/supabase',()=>({supabase:{}}));
let root:ReactTestRenderer|undefined;
afterEach(()=>{act(()=>root?.unmount());root=undefined;vi.useRealTimers();vi.unstubAllGlobals();mock.invoke.mockReset();});
const owner='dashboard-test';
const observation=(path:string)=>({endpoint_id:CAPABILITIES.find(c=>c.path===path)!.id,parameters:{},payload:path==='/user/bars'?{bars:{energy:{current:42,maximum:100}}}:{},fetched_at:new Date().toISOString(),next_parameters:null});
async function mount(options:{stored?:boolean;fresh?:boolean;failure?:boolean}={}){
 vi.useFakeTimers();vi.stubGlobal('location',{hash:'#Overview'});vi.stubGlobal('window',{addEventListener:vi.fn(),removeEventListener:vi.fn()});vi.stubGlobal('document',{addEventListener:vi.fn(),removeEventListener:vi.fn(),visibilityState:'visible'});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 client.setQueryData(['observation-owner'],owner);
 client.setQueryData(['torn-connection',owner],{identity:null,hasStoredKey:options.stored!==false});
 let entries={};if(options.fresh)for(const path of ESSENTIAL_PATHS)entries=mergeObservation(entries,observation(path));
 client.setQueryData(observationsKey(owner),entries);
 mock.invoke.mockImplementation(async(_client,{body})=>options.failure?{data:{error:'No key available'},error:null}:{data:observation(CAPABILITIES.find(c=>c.id===body.endpoint_id)!.path),error:null});
 await act(async()=>{root=create(<QueryClientProvider client={client}><MyTorn accountId={owner}/></QueryClientProvider>);});
 await act(async()=>{await vi.advanceTimersByTimeAsync(12000);});
 return client;
}
describe('dashboard after sign-in',()=>{
 it('loads four essentials using the encrypted server key and displays returned bars',async()=>{
  await mount();expect(mock.invoke).toHaveBeenCalledTimes(4);
  for(const [,options] of mock.invoke.mock.calls)expect(options.body).not.toHaveProperty('apiKey');
  expect(JSON.stringify(root!.toJSON())).toContain('42 / 100');
  await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});expect(mock.invoke).toHaveBeenCalledTimes(4);
 });
 it('reuses fresh essentials without API calls',async()=>{await mount({fresh:true});expect(mock.invoke).not.toHaveBeenCalled();expect(JSON.stringify(root!.toJSON())).toContain('Reusing saved observations');});
 it('falls back to request-only mode when no key was saved',async()=>{await mount({stored:false});expect(mock.invoke).not.toHaveBeenCalled();expect(root!.root.findAllByType('select').some(select=>select.props.value==='request')).toBe(true);expect(JSON.stringify(root!.toJSON())).toContain('Connect a Torn API key');});
 it('surfaces failures with a retry button and does not loop',async()=>{await mount({failure:true});expect(mock.invoke).toHaveBeenCalledTimes(1);expect(JSON.stringify(root!.toJSON())).toContain('No key available');expect(root!.root.findAllByType('button').some(button=>button.children.includes('Retry essentials'))).toBe(true);});
});
