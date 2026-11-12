export const MAX_ACTIVE_WAR_CLAIMS=3;
import type {WarTarget,WarOpponent} from '../../supabase/functions/_shared/war-targets';
export type {WarTarget,WarOpponent};
export type WarTargetList={user_id:string;faction_id:number;war_key:string;enemy_faction_id:number;target_ids:number[];targets:WarTarget[];active:boolean;alerts_enabled:boolean;updated_by:number;revision:number;verified_until:string;updated_at:string;priorities?:Record<string,number>;war_start?:number;war_end?:number|null;resting?:boolean};
export type WarTargetContext={actor_id:number;faction_id:number;can_manage:boolean;is_leader?:boolean;members:WarTarget[];wars:WarOpponent[];enemies:WarTarget[];list:WarTargetList|null;assignee_id:number;war_key:string|null;assignment_revision:number|null;board?:{id:number;name:string;linked:boolean;assignment:{target_ids:number[];priorities:Record<string,number>;updated_by:number}|null}[];history?:WarEvent[]};
export const attackUrl=(id:number)=>`https://www.torn.com/loader.php?sid=attack&user2ID=${id}`;
export const hospitalAlertKey=(owner:string,war:string,target:WarTarget)=>`war-hospital:${owner}:${war}:${target.id}:${target.hospital_until}`;
export function alertDeadline(target:WarTarget,now=Date.now(),leadSeconds=20):number|null{
 if(target.state!=='Hospital'||!Number.isSafeInteger(target.hospital_until)||Number(target.hospital_until)*1000<=now)return null;
 return Number(target.hospital_until)*1000-leadSeconds*1000;
}
/** Local deadlines only. Late wakeups never announce an already-expired hospital. */
export function scheduleHospitalAlerts(list:WarTargetList,owner:string,notify:(target:WarTarget,key:string)=>void,seen:(key:string)=>boolean,now=Date.now,options:{leadSeconds?:number;requirePrecheck?:boolean}={}){
 if(!list.active||list.resting||!list.alerts_enabled||Date.parse(list.verified_until)<=now())return ()=>{};
 const timers=list.targets.filter(t=>list.target_ids.includes(t.id)).flatMap(target=>{
  const at=alertDeadline(target,now(),options.leadSeconds??20);if(at===null||at>=Date.parse(list.verified_until))return [];
  const key=hospitalAlertKey(owner,list.war_key,target);if(seen(key))return [];
  return [setTimeout(()=>{if(!seen(key)&&now()<Number(target.hospital_until)*1000&&now()<Date.parse(list.verified_until)&&(!options.requirePrecheck||Number(target.checked_at)>=at-10000))notify(target,key);},Math.max(0,at-now()))];
 });
 return ()=>timers.forEach(clearTimeout);
}
export type WarClaim={faction_id:number;war_key:string;target_id:number;user_id:string;claimant_torn_id:number;claimant_name:string;expires_at:string;claim_id:string;claimed_at:string;attacks_goal:number;attacks_done:number};
export type WarAlertPreferences={lead_seconds:number;sound:'off'|'soft'|'double';volume:number;desktop:boolean};
export const defaultWarPreferences:WarAlertPreferences={lead_seconds:20,sound:'off',volume:0.5,desktop:true};
export function sortWarTargets(targets:WarTarget[],priorities:Record<string,number>={},now=Date.now()){
 const group=(t:WarTarget)=>t.state==='Okay'?0:t.state==='Hospital'&&t.hospital_until&&t.hospital_until*1000>now?1:2;
 return [...targets].sort((a,b)=>group(a)-group(b)||(priorities[a.id]??2)-(priorities[b.id]??2)||(group(a)===1?Number(a.hospital_until)-Number(b.hospital_until):0)||a.name.localeCompare(b.name));
}
export type WarEvent={id?:number;actor_torn_id:number;member_id?:number;kind:string;details:any;created_at:string};
export type WarReport={war_key:string;war_start:number;war_end:number|null;attacks:{id:string;defender:number;ended:number;result:string;respect:number}[];coverage:string;next_parameters:unknown;updated_at:string};
/** An availability window means observed Okay, never inferred from a passed timer. */
export function warReportSummary(report:WarReport,events:WarEvent[]){
 const attacks=report.attacks??[],results:Record<string,number>={};for(const attack of attacks)results[attack.result]=(results[attack.result]??0)+1;
 let unhit=0,windows=0;
 const states=events.filter(e=>e.kind==='status').sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at));
 for(let i=0;i<states.length;i++){
  const e=states[i];if(e.details.state!=='Okay')continue;
  const start=Date.parse(e.created_at)/1000;
  const close=states.slice(i+1).find(n=>n.details.target_id===e.details.target_id);
  const end=close?Date.parse(close.created_at)/1000:report.war_end??Date.parse(report.updated_at)/1000;
  if(end<start)continue;windows++;
  if(!attacks.some(a=>a.defender===e.details.target_id&&a.ended>=start&&a.ended<=end))unhit++;
 }
 return {hits:attacks.length,respect:attacks.reduce((n,a)=>n+a.respect,0),results,windows,unhit,changes:events.filter(e=>e.kind==='assignment').length};
}

export type RestedWarClaim={user_id:string;faction_id:number;war_key:string;target_id:number;target_name:string;attacks_goal:number;attacks_done:number;rested_at:string};
