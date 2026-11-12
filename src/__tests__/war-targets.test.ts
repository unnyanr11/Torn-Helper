import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {activeOpponents,authorizeAssignee,rosterTargets,validateSelection} from '../../supabase/functions/_shared/war-targets';
import {alertDeadline,scheduleHospitalAlerts,type WarTargetList,type WarTarget} from '../lib/war-targets';
const now=1800000000000;
const war=(extra={})=>({war_id:7,start:now/1000-60,end:null,factions:[{id:1,name:'Us'},{id:2,name:'Enemy'}],...extra});
const hospital=(extra={}):WarTarget=>({id:50,name:'Target',level:10,state:'Hospital',hospital_until:now/1000+100,...extra});
const list=(extra={}):WarTargetList=>({user_id:'owner',faction_id:1,war_key:'ranked:7:2',enemy_faction_id:2,target_ids:[50],targets:[hospital()],active:true,alerts_enabled:true,updated_by:1,revision:1,updated_at:new Date(now).toISOString(),verified_until:new Date(now+120000).toISOString(),...extra});
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(now);});afterEach(()=>vi.useRealTimers());
describe('verified war target permissions',()=>{
 it('detects ranked, raid and territory opponents; rejects scheduled, ended and unrelated wars',()=>{
  const wars={ranked:war(),raids:[war({war_id:8}),war({war_id:9,start:now/1000+60}),war({war_id:10,end:now/1000-1})],territory:[war({war_id:11}),war({war_id:12,factions:[{id:3},{id:4}]})]};
  expect(activeOpponents({wars},1,now).map(w=>w.key)).toEqual(['ranked:7:2','raid:8:2','territory:11:2']);
  expect(()=>activeOpponents({},1,now)).toThrow();
 });
 it('permits self selection and only the actual leader editing a current member',()=>{
  const roster=[hospital({id:1}),hospital({id:2})];
  expect(()=>authorizeAssignee(2,2,1,[])).not.toThrow();
  expect(()=>authorizeAssignee(1,2,1,roster)).not.toThrow();
  expect(()=>authorizeAssignee(2,1,1,roster)).toThrow();
  expect(()=>authorizeAssignee(1,3,1,roster)).toThrow();
  expect(()=>authorizeAssignee(1,2,1,[roster[1]])).toThrow();
 });
 it('keeps only valid enemy IDs and only Hospital status yields a release deadline',()=>{
  const roster=rosterTargets({members:[{id:50,name:'One',status:{state:'Hospital',until:now/1000+100}},{id:51,name:'Two',status:{state:'Okay',until:now/1000+100}}]});
  expect(roster[1].hospital_until).toBeNull();expect(validateSelection([50],roster)).toEqual([50]);
  for(const ids of [[50,50],[999],['50'],Array(101).fill(50)])expect(()=>validateSelection(ids,roster)).toThrow();
  expect(()=>rosterTargets({})).toThrow();
 });
});
describe('hospital popup scheduling without API calls',()=>{
 it('fires exactly 20 seconds before release and deduplicates that hospital stay',async()=>{
  const seen=new Set<string>(),notify=vi.fn((_t,key)=>seen.add(key));
  expect(alertDeadline(hospital(),now)).toBe(now+80000);
  const cancel=scheduleHospitalAlerts(list(),'owner',notify,k=>seen.has(k));
  await vi.advanceTimersByTimeAsync(79999);expect(notify).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);expect(notify).toHaveBeenCalledTimes(1);cancel();
  scheduleHospitalAlerts(list(),'owner',notify,k=>seen.has(k));await vi.advanceTimersByTimeAsync(1000);expect(notify).toHaveBeenCalledTimes(1);
 });
 it('cancels old deadlines when revived, reassigned or removed and schedules a changed stay',async()=>{
  const notify=vi.fn();const cancel=scheduleHospitalAlerts(list(),'owner',notify,()=>false);cancel();
  scheduleHospitalAlerts(list({targets:[hospital({state:'Okay',hospital_until:null})]}),'owner',notify,()=>false);
  await vi.advanceTimersByTimeAsync(80000);expect(notify).not.toHaveBeenCalled();
  scheduleHospitalAlerts(list({targets:[hospital({hospital_until:now/1000+110})]}),'owner',notify,()=>false);
  await vi.advanceTimersByTimeAsync(10000);expect(notify).toHaveBeenCalledTimes(1);
 });
 it('never alerts for disabled, ended, unselected, expired or unverified data',async()=>{
  const notify=vi.fn();
  for(const row of [list({active:false}),list({alerts_enabled:false}),list({target_ids:[]}),list({verified_until:new Date(now-1).toISOString()}),list({targets:[hospital({hospital_until:now/1000-1})]})])scheduleHospitalAlerts(row,'owner',notify,()=>false);
  await vi.advanceTimersByTimeAsync(200000);expect(notify).not.toHaveBeenCalled();
 });
 it('does not deliver a stale popup after browser sleep; distinct stays and owners have different keys',async()=>{
  const notify=vi.fn();scheduleHospitalAlerts(list(),'owner',notify,()=>false);vi.setSystemTime(now+200000);await vi.advanceTimersByTimeAsync(80000);expect(notify).not.toHaveBeenCalled();
 });
});
