import type {WarTarget,WarOpponent} from '../../supabase/functions/_shared/war-targets';
export type {WarTarget,WarOpponent};
export type WarTargetList={user_id:string;faction_id:number;war_key:string;enemy_faction_id:number;target_ids:number[];targets:WarTarget[];active:boolean;alerts_enabled:boolean;updated_by:number;revision:number;verified_until:string;updated_at:string};
export type WarTargetContext={actor_id:number;faction_id:number;can_manage:boolean;members:WarTarget[];wars:WarOpponent[];enemies:WarTarget[];list:WarTargetList|null;assignee_id:number;war_key:string|null;assignment_revision:number|null};
export const attackUrl=(id:number)=>`https://www.torn.com/loader.php?sid=attack&user2ID=${id}`;
export const hospitalAlertKey=(owner:string,war:string,target:WarTarget)=>`war-hospital:${owner}:${war}:${target.id}:${target.hospital_until}`;
export function alertDeadline(target:WarTarget,now=Date.now()):number|null{
 if(target.state!=='Hospital'||!Number.isSafeInteger(target.hospital_until)||Number(target.hospital_until)*1000<=now)return null;
 return Number(target.hospital_until)*1000-20000;
}
/** Local deadlines only. Late wakeups never announce an already-expired hospital. */
export function scheduleHospitalAlerts(list:WarTargetList,owner:string,notify:(target:WarTarget,key:string)=>void,seen:(key:string)=>boolean,now=Date.now){
 if(!list.active||!list.alerts_enabled||Date.parse(list.verified_until)<=now())return ()=>{};
 const timers=list.targets.filter(t=>list.target_ids.includes(t.id)).flatMap(target=>{
  const at=alertDeadline(target,now());if(at===null||at>=Date.parse(list.verified_until))return [];
  const key=hospitalAlertKey(owner,list.war_key,target);if(seen(key))return [];
  return [setTimeout(()=>{if(!seen(key)&&now()<Number(target.hospital_until)*1000&&now()<Date.parse(list.verified_until))notify(target,key);},Math.max(0,at-now()))];
 });
 return ()=>timers.forEach(clearTimeout);
}
