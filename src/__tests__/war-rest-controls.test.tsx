import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,describe,it,expect,vi} from 'vitest';
import WarRestControls from '../components/WarRestControls';
const mocks=vi.hoisted(()=>({list:{resting:false} as any,action:vi.fn(),refresh:vi.fn(),rows:[] as any[]}));
vi.mock('../components/WarTargetProvider',()=>({useWarTargets:()=>({owner:'owner',list:mocks.list,refresh:mocks.refresh}),warTargetAction:(body:any)=>mocks.action(body)}));
vi.mock('../lib/supabase',()=>({supabase:{from:()=>({select:()=>({eq:async()=>({data:mocks.rows,error:null})})}),channel:()=>{const channel:any={on:()=>channel,subscribe:()=>channel};return channel;},removeChannel:vi.fn()}}));
let root:ReactTestRenderer|undefined;
afterEach(()=>{act(()=>root?.unmount());root=undefined;mocks.action.mockReset();mocks.list={resting:false};mocks.rows=[];});
async function mount(){const cache=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});cache.setQueryData(['war-rest','owner'],mocks.rows);await act(async()=>{root=create(<QueryClientProvider client={cache}><WarRestControls/></QueryClientProvider>);});}
describe('rest and return controls',()=>{
 it('releases claims without asking for new attack counts and displays the saved remaining goal',async()=>{
  mocks.rows=[{war_key:'ranked:7:2',target_id:50,target_name:'Target',attacks_goal:3,attacks_done:1}];mocks.action.mockResolvedValue({released:1});await mount();
  expect(JSON.stringify(root!.toJSON())).toContain('2');
  const button=root!.root.findAllByType('button').find(b=>b.children.includes('I’m going to rest'))!;
  await act(async()=>{await button.props.onClick();});expect(mocks.action).toHaveBeenCalledWith({action:'rest'});expect(JSON.stringify(root!.toJSON())).toContain('Released 1 claims');
 });
 it('shows a blocked return clearly instead of claiming another member’s target',async()=>{
  mocks.list={resting:true};mocks.rows=[{war_key:'ranked:7:2',target_id:50,target_name:'Target',attacks_goal:3,attacks_done:1}];mocks.action.mockResolvedValue({resumed:[],blocked:[{name:'Target',reason:'Already claimed by Teammate'}],discarded:[]});await mount();
  const button=root!.root.findAllByType('button').find(b=>b.children.includes('I’m back'))!;
  await act(async()=>{await button.props.onClick();});expect(mocks.action).toHaveBeenCalledWith({action:'resume'});expect(JSON.stringify(root!.toJSON())).toContain('Already claimed by Teammate');
 });
});
