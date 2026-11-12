import {act,create} from 'react-test-renderer';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect,vi} from 'vitest';
import WarRoom from '../pages/WarRoom';
const mocks=vi.hoisted(()=>({list:null as any,claims:null as any}));
vi.mock('../components/WarTargetProvider',()=>({useWarTargets:()=>({list:mocks.list,error:'',owner:'owner',claims:mocks.claims??[{target_id:1,user_id:'owner',claimant_name:'Me',expires_at:new Date(Date.now()+60000).toISOString(),attacks_done:0,attacks_goal:2}],refresh:vi.fn()}),warTargetAction:vi.fn()}));
vi.mock('../components/WarCoordination',()=>({default:()=>null}));
vi.mock('../lib/war-governance',()=>({governanceAction:vi.fn()}));
vi.mock('../components/WarRestControls',()=>({default:()=>null}));
vi.mock('../components/TimerProvider',()=>({useAccountTimers:()=>({baselines:[]})}));
describe('assigned-only War Room attack view',()=>{
 it('shows only selected targets and no attack button for hospital, travel or stale data',()=>{
  mocks.list={active:true,target_ids:[1,2,3],updated_at:new Date().toISOString(),verified_until:new Date(Date.now()+60000).toISOString(),targets:[{id:1,name:'Ready target',state:'Okay',level:1,hospital_until:null},{id:2,name:'Hospital target',state:'Hospital',level:1,hospital_until:Math.floor(Date.now()/1000)+100},{id:3,name:'Flying target',state:'Traveling',level:1,hospital_until:null},{id:4,name:'Not assigned',state:'Okay',level:1,hospital_until:null}]};
  let html=renderToStaticMarkup(<WarRoom/>);expect(html).toContain('Ready target');expect(html).not.toContain('Not assigned');expect(html).toContain('user2ID=1');expect(html).not.toContain('user2ID=2');expect(html).not.toContain('user2ID=3');
  mocks.list.verified_until=new Date(0).toISOString();html=renderToStaticMarkup(<WarRoom/>);expect(html).not.toContain('user2ID=1');expect(html).toContain('Status verification expired');
 });
});

it('permits another claim with two active reservations and disables a fourth claim at the cap',async()=>{
 mocks.list={active:true,target_ids:[1,2,3,4],verified_until:new Date(Date.now()+60000).toISOString(),updated_at:new Date().toISOString(),targets:[1,2,3,4].map(id=>({id,name:`Target ${id}`,state:'Okay',level:1,hospital_until:null}))};
 const held=(id:number)=>({target_id:id,user_id:'owner',claimant_name:'Me',expires_at:new Date(Date.now()+60000).toISOString(),attacks_done:0,attacks_goal:1});
 mocks.claims=[held(1),held(2)];let root!:ReturnType<typeof create>;
 try{
  await act(async()=>{root=create(<WarRoom/>);});
  let buttons=root.root.findAllByType('button').filter(b=>b.children.includes('Claim target'));expect(buttons).toHaveLength(2);expect(buttons.every(b=>!b.props.disabled)).toBe(true);
  mocks.claims=[held(1),held(2),held(3)];await act(async()=>{root.update(<WarRoom/>);});
  buttons=root.root.findAllByType('button').filter(b=>b.children.includes('Claim target'));expect(buttons).toHaveLength(1);expect(buttons[0].props.disabled).toBe(true);
 }finally{act(()=>root.unmount());mocks.claims=null;}
});
