import {describe,it,expect,vi,afterEach} from 'vitest';
import {validAlertPreferences,validPriorities} from '../../supabase/functions/_shared/war-targets';
import {attackRecords,attackNext,mergeWarAttacks} from '../../supabase/functions/_shared/war-reports';
import {sortWarTargets,warReportSummary,scheduleHospitalAlerts,type WarTargetList} from '../lib/war-targets';
afterEach(()=>vi.useRealTimers());
it('sorts available first, then hospital, with priority inside each group',()=>{
 const make=(id:number,state:string,until:number|null=null)=>({id,name:String(id),state,level:1,hospital_until:until});
 const rows=[make(1,'Hospital',200),make(2,'Okay'),make(3,'Okay'),make(4,'Traveling'),make(5,'Hospital',150)];
 expect(sortWarTargets(rows,{'3':1},0).map(t=>t.id)).toEqual([3,2,5,1,4]);
 expect(()=>validPriorities({'99':1},[1])).toThrow();expect(validPriorities({'1':1},[1])).toEqual({'1':1});
});
it('validates customizable alert timing and volume',()=>{
 expect(validAlertPreferences({lead_seconds:40,sound:'double',volume:0.8,desktop:true}).lead_seconds).toBe(40);
 for(const lead of [0,121,NaN])expect(()=>validAlertPreferences({lead_seconds:lead,sound:'off',volume:0.5,desktop:true})).toThrow();
 expect(()=>validAlertPreferences({lead_seconds:20,sound:'double',volume:2,desktop:true})).toThrow();
});
it('requires the targeted pre-alert check and honors custom warning timing',async()=>{
 vi.useFakeTimers();vi.setSystemTime(0);
 const base={user_id:'a',active:true,alerts_enabled:true,target_ids:[1],war_key:'x',verified_until:new Date(200000).toISOString(),targets:[{id:1,name:'One',state:'Hospital',hospital_until:100,level:1,checked_at:0}]} as WarTargetList;
 const alert=vi.fn();scheduleHospitalAlerts(base,'a',alert,()=>false,Date.now,{leadSeconds:30,requirePrecheck:true});await vi.advanceTimersByTimeAsync(70000);expect(alert).not.toHaveBeenCalled();
 const refreshed={...base,targets:[{...base.targets[0],checked_at:60000}]};scheduleHospitalAlerts(refreshed,'a',alert,()=>false,Date.now,{leadSeconds:30,requirePrecheck:true});await vi.advanceTimersByTimeAsync(0);expect(alert).toHaveBeenCalledTimes(1);
});
it('counts only own completed attacks in the requested window; preserves losses, rejects interrupted attacks',()=>{
 const a={id:1,attacker:{id:1},defender:{id:50,faction:{id:20}},started:100,ended:110,result:'Lost',respect_gain:0};
 const rows=attackRecords({attacks:[a,{...a,id:2,attacker:{id:2}},{...a,id:3,is_interrupted:true},{...a,id:4,started:50},{...a,id:5,defender:{id:60,faction:{id:99}}}]},1,90,120,20);
 expect(rows).toHaveLength(1);expect(rows[0].result).toBe('Lost');expect(mergeWarAttacks(rows,rows)).toHaveLength(1);
});
it('bounds pagination to the original own attack path and window',()=>{
 const params={from:'100',to:'200',limit:'100',sort:'ASC',filters:'outgoing'};
 expect(attackNext({_metadata:{links:{next:'https://api.torn.com/v2/user/attacks?from=150&to=200'}}},params)?.from).toBe('150');
 for(const next of ['https://evil.test/v2/user/attacks?from=150','https://api.torn.com/v2/faction/attacks?from=150','https://api.torn.com/v2/user/attacks?from=150&to=300','https://api.torn.com/v2/user/attacks?from=100'])expect(()=>attackNext({_metadata:{links:{next}}},params)).toThrow();
});
it('labels sampled availability windows rather than inventing a complete missed-hit history',()=>{
 const report:any={war_start:1,war_end:50,updated_at:new Date(50000).toISOString(),attacks:[{id:'1',defender:1,ended:20,result:'Lost',respect:0}]};
 const events:any=[{kind:'status',created_at:new Date(10000).toISOString(),details:{target_id:1,state:'Okay'}},{kind:'status',created_at:new Date(30000).toISOString(),details:{target_id:1,state:'Hospital'}},{kind:'status',created_at:new Date(40000).toISOString(),details:{target_id:2,state:'Okay'}},{kind:'assignment',details:{},created_at:new Date(0).toISOString()}];
 expect(warReportSummary(report,events)).toMatchObject({hits:1,windows:2,unhit:1,changes:1,results:{Lost:1}});
});
