import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect,vi} from 'vitest';
import WarRoom from '../pages/WarRoom';
const mocks=vi.hoisted(()=>({list:null as any}));
vi.mock('../components/WarTargetProvider',()=>({useWarTargets:()=>({list:mocks.list,error:'',owner:'owner',claims:[{target_id:1,user_id:'owner',claimant_name:'Me',expires_at:new Date(Date.now()+60000).toISOString(),attacks_done:0,attacks_goal:2}],refresh:vi.fn()}),warTargetAction:vi.fn()}));
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
