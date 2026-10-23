import type { StarterTarget } from '../data/levelling-targets';
import type { TornObservation } from './personal-data';
export interface TargetObservation { id:number;name:string;level:number;state:string;life:number|null;maximumLife:number|null;lastAction:number|null;fetchedAt:string }
export function targetObservation(id:number,data:TornObservation):TargetObservation{
 const p=(data.payload as any)?.profile;
 if(!p||p.id!==id||typeof p.name!=='string'||!Number.isInteger(p.level)||p.level<1||p.level>100)throw new Error('Torn did not return the requested target profile.');
 return {id,name:p.name,level:p.level,state:typeof p.status?.state==='string'?p.status.state:'Unknown',life:typeof p.life?.current==='number'?p.life.current:null,maximumLife:typeof p.life?.maximum==='number'?p.life.maximum:null,lastAction:typeof p.last_action?.timestamp==='number'&&Number.isFinite(p.last_action.timestamp)?p.last_action.timestamp:null,fetchedAt:data.fetched_at};
}
export const TARGET_FRESH_MS=5*60000;
export function targetAvailability(row:TargetObservation|undefined,now=Date.now()){
 if(!row)return 'Not checked';
 const age=now-Date.parse(row.fetchedAt);
 if(!Number.isFinite(age)||age<0||age>TARGET_FRESH_MS)return 'Check again';
 if(row.state!=='Okay')return row.state;
 if(row.life!==null&&row.life<=0)return 'Check again';
 return 'Available';
}
export function targetInactive(row:TargetObservation|undefined,days:number,now=Date.now()){
 return !!row&&row.lastAction!==null&&row.lastAction>0&&row.lastAction*1000<=now-days*86400000;
}
/** Check unknown/stale profiles first, oldest first; retain the chosen list order for ties. */
export function nextTargetChecks(rows:StarterTarget[],observations:Record<number,TargetObservation>,limit=8,now=Date.now()){
 return rows.filter(r=>['Not checked','Check again'].includes(targetAvailability(observations[r.id],now))).sort((a,b)=>{
  const time=(id:number)=>{const value=Date.parse(observations[id]?.fetchedAt??'');return Number.isFinite(value)?value:0;};
  return time(a.id)-time(b.id);
 }).slice(0,limit).map(r=>r.id);
}
export function mergeTargetObservations(old:Record<number,TargetObservation>,incoming:Record<number,TargetObservation>){
 const next={...old};for(const row of Object.values(incoming)){if(Number.isFinite(Date.parse(row.fetchedAt))&&(!next[row.id]||!Number.isFinite(Date.parse(next[row.id].fetchedAt))||Date.parse(row.fetchedAt)>Date.parse(next[row.id].fetchedAt)))next[row.id]=row;}return next;
}
export function targetActivityMatches(row:TargetObservation|undefined,filter:string,now=Date.now()){
 if(filter==='any')return true;
 const time=row?.lastAction;
 if(filter==='unknown')return !time||time*1000>now;
 if(filter==='recent')return !!time&&time>0&&time*1000<=now&&!targetInactive(row,30,now);
 return ['7','30','90'].includes(filter)&&targetInactive(row,Number(filter),now);
}
export function filterStarterTargets(rows:StarterTarget[],observations:Record<number,TargetObservation>,maximum:number,availability:string,sort:string,now=Date.now(),inactive='any'){
 return rows.filter(r=>{
  const row=observations[r.id];
  // Accept old saved activity filters while keeping status and inactivity independent.
  const statusMatches=availability==='All'||(availability==='Recently active'?targetActivityMatches(row,'recent',now):availability==='Activity unknown'?targetActivityMatches(row,'unknown',now):targetAvailability(row,now)===availability);
  return r.reportedTotal<=maximum&&statusMatches&&targetActivityMatches(row,inactive,now);
 }).sort((a,b)=>{
  if(sort==='level')return (observations[b.id]?.level??b.reportedLevel)-(observations[a.id]?.level??a.reportedLevel)||a.reportedTotal-b.reportedTotal;
  if(sort==='name')return (observations[a.id]?.name??a.name).localeCompare(observations[b.id]?.name??b.name);
  return a.reportedTotal-b.reportedTotal||b.reportedLevel-a.reportedLevel;
 });
}
