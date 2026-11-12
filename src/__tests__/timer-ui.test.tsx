import {afterEach,it,expect,vi} from 'vitest';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import TimerProvider from '../components/TimerProvider';
import TimerPanel from '../components/TimerPanel';
const mocks=vi.hoisted(()=>({from:vi.fn(),change:()=>{}}));
vi.mock('../lib/supabase',()=>({supabase:{from:mocks.from,channel:()=>{const channel={on:(_event:unknown,_filter:unknown,callback:()=>void)=>{mocks.change=callback;return channel;},subscribe:(callback:(state:string)=>void)=>{callback('SUBSCRIBED');return channel;}};return channel;},removeChannel:vi.fn()}}));
let root:ReactTestRenderer|undefined;
afterEach(()=>{act(()=>root?.unmount());root=undefined;vi.useRealTimers();vi.unstubAllGlobals();mocks.from.mockReset();});
it('ticks saved deadlines to zero with no network call and no baseline reset on render',async()=>{
 vi.useFakeTimers();vi.setSystemTime(1800000000000);vi.stubGlobal('document',{visibilityState:'visible'});
 const client=new QueryClient(),owner='timer-owner';
 client.setQueryData(['account-timers',owner],{baselines:[{endpoint_id:'v2-user-cooldowns',payload:{cooldowns:{drug:5}},observed_at:new Date().toISOString(),deadlines:{drug:1800000005}}],status:{checked_through:1800000000,status:'watching',message:null}});
 await act(async()=>{root=create(<QueryClientProvider client={client}><TimerProvider owner={owner}><TimerPanel/></TimerProvider></QueryClientProvider>);});
 expect(JSON.stringify(root!.toJSON())).toContain('5s');
 await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});expect(JSON.stringify(root!.toJSON())).toContain('3s');
 await act(async()=>{await vi.advanceTimersByTimeAsync(4000);});expect(JSON.stringify(root!.toJSON())).toContain('Elapsed · estimated');expect(mocks.from).not.toHaveBeenCalled();
});

it('receives a changed backend baseline through Realtime and updates the frontend without Torn polling',async()=>{
 vi.useFakeTimers();vi.setSystemTime(1800000000000);vi.stubGlobal('document',{visibilityState:'visible'});
 const client=new QueryClient(),owner='timer-owner';
 const old={endpoint_id:'v2-user-cooldowns',payload:{cooldowns:{drug:5}},observed_at:new Date().toISOString(),deadlines:{drug:1800000005}};
 const status={checked_through:1800000000,status:'watching',message:null,updated_at:new Date().toISOString()};
 client.setQueryData(['account-timers',owner],{baselines:[old],status});
 const updated={...old,payload:{cooldowns:{drug:30}},deadlines:{drug:1800000030}};
 mocks.from.mockImplementation(table=>({select:()=>({eq:()=>table==='torn_timer_baselines'?Promise.resolve({data:[updated],error:null}):{maybeSingle:async()=>({data:status,error:null})}})}));
 await act(async()=>{root=create(<QueryClientProvider client={client}><TimerProvider owner={owner}><TimerPanel/></TimerProvider></QueryClientProvider>);});
 expect(JSON.stringify(root!.toJSON())).toContain('5s');
 await act(async()=>{mocks.change();await vi.advanceTimersByTimeAsync(10);});
 expect(JSON.stringify(root!.toJSON())).toContain('30s');
 expect(JSON.stringify(root!.toJSON())).toContain('Frontend synced at');
 expect(JSON.stringify(root!.toJSON())).toContain('Live database connection');
 expect(mocks.from).toHaveBeenCalledWith('torn_timer_baselines');
 expect(client.getQueryData<any>(['torn-observations',owner])['v2-user-cooldowns:[]'].observation.payload.cooldowns.drug).toBe(30);
});
