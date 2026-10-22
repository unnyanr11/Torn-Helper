import type { StarterTarget } from '../data/levelling-targets';
import type { TornObservation } from './personal-data';
export interface TargetObservation { id:number;name:string;level:number;state:string;life:number|null;maximumLife:number|null;lastAction:number|null;fetchedAt:string }
export function targetObservation(id:number,data:TornObservation):TargetObservation{
 const p=(data.payload as any)?.profile;
 if(!p||p.id!==id||typeof p.name!=='string'||!Number.isInteger(p.level)||p.level<1||p.level>100)throw new Error('Torn did not return the requested target profile.');
 return {id,name:p.name,level:p.level,state:typeof p.status?.state==='string'?p.status.state:'Unknown',life:typeof p.life?.current==='number'?p.life.current:null,maximumLife:typeof p.life?.maximum==='number'?p.life.maximum:null,lastAction:typeof p.last_action?.timestamp==='number'&&Number.isFinite(p.last_action.timestamp)?p.last_action.timestamp:null,fetchedAt:data.fetched_at};
}
export function targetAvailability(row:TargetObservation|undefined,now=Date.now()){
 if(!row)return 'Not checked';
 const age=now-Date.parse(row.fetchedAt);
 if(!Number.isFinite(age)||age<0||age>60000)return 'Check again';
 if(row.state!=='Okay')return row.state;
 if(row.lastAction===null)return 'Activity unknown';
 if(row.lastAction*1000>now-30*86400000)return 'Recently active';
 if(row.life!==null&&row.life<=0)return 'Check again';
 return 'Available';
}
export function filterStarterTargets(rows:StarterTarget[],observations:Record<number,TargetObservation>,maximum:number,availability:string,sort:string,now=Date.now()){
 return rows.filter(r=>r.reportedTotal<=maximum&&(availability==='All'||targetAvailability(observations[r.id],now)===availability)).sort((a,b)=>{
  if(sort==='level')return (observations[b.id]?.level??b.reportedLevel)-(observations[a.id]?.level??a.reportedLevel)||a.reportedTotal-b.reportedTotal;
  if(sort==='name')return (observations[a.id]?.name??a.name).localeCompare(observations[b.id]?.name??b.name);
  return a.reportedTotal-b.reportedTotal||b.reportedLevel-a.reportedLevel;
 });
}
