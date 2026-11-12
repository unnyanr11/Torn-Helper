import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,it,expect,vi} from 'vitest';
import WarCoordination from '../components/WarCoordination';
const m=vi.hoisted(()=>({data:null as any,action:vi.fn()}));
vi.mock('../components/WarTargetProvider',()=>({useWarTargets:()=>({owner:'me',list:{active:true,war_key:'ranked:7:2'},refresh:vi.fn()})}));
vi.mock('../lib/war-governance',()=>({governanceAction:(body:any)=>m.action(body),governanceKey:(owner:string)=>['war-governance',owner]}));
let root:ReactTestRenderer|undefined;
afterEach(()=>{act(()=>root?.unmount());root=undefined;m.action.mockReset();});
async function mount(extra:any={}){
 m.data={faction_id:1,war_key:'ranked:7:2',actor_id:2,leader_id:1,is_leader:false,can_manage:false,max_attacks:3,members:[{id:1,name:'Leader'},{id:2,name:'Member'}],enemies:[],handlers:[],rules:[],queue:[],requests:[],notices:[],...extra};m.action.mockResolvedValue(m.data);
 const cache=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});cache.setQueryData(['war-governance','me'],m.data);await act(async()=>{root=create(<QueryClientProvider client={cache}><WarCoordination/></QueryClientProvider>);});
}
it('shows handler coordination controls without leader-only appointment or policy controls',async()=>{
 await mount({can_manage:true});const tree=JSON.stringify(root!.toJSON());expect(tree).toContain('Leadership-assigned mode');expect(tree).not.toContain('Appoint war handlers and set limits');
});
it('acceptance is explicit and sends only the request ID and decision',async()=>{
 await mount({requests:[{id:'request',holder:'me',requester:'other',target_id:50,swap_target_id:null,expires_at:new Date(Date.now()+60000).toISOString()}]});
 const button=root!.root.findAllByType('button').find(b=>b.children.includes('Accept'))!;await act(async()=>{await button.props.onClick();});
 expect(m.action).toHaveBeenCalledWith({action:'respond',request_id:'request',accept:true,war_key:'ranked:7:2'});
});
it('members see fairness defaults and requests without privileged controls',async()=>{
 await mount();const tree=JSON.stringify(root!.toJSON());expect(tree).toContain('Up to three active reservations');expect(tree).not.toContain('Apply leadership decision');expect(tree).toContain('Default goal: one attack');
});
