import {afterEach,it,expect,vi} from 'vitest';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import TimerProvider from '../components/TimerProvider';
import TimerPanel from '../components/TimerPanel';
const mocks=vi.hoisted(()=>({from:vi.fn()}));
vi.mock('../lib/supabase',()=>({supabase:{from:mocks.from}}));
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
