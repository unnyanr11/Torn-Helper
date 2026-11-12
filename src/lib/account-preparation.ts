import {CAPABILITIES} from '../api/capabilities';
import {request,type ConnectedRequest} from './connected-data';
import {ESSENTIAL_PATHS} from './home-dashboard';
export const PREPARATION_MS=60000,PREPARATION_CALLS=ESSENTIAL_PATHS.length;
/** Only the dashboard's own-player essentials load automatically. Optional tools
 * keep their explicit Load actions; no padding requests are made to fill time.
 */
export function preparationPlan():ConnectedRequest[]{
 return ESSENTIAL_PATHS.map(path=>request(path,'Personal'));
}
export type PreparationIssue={endpoint:string;label:string;reason:string;kind:'restricted'|'not_applicable'|'failed'};
export type PreparationProgress={started:number;loaded:number;failed:number;active:number;current:string;problem:string;issues:PreparationIssue[]};
export const emptyProgress=():PreparationProgress=>({started:0,loaded:0,failed:0,active:0,current:'Preparing environment',problem:'',issues:[]});
export type PreparationResult=PreparationProgress&{finishedAt:number};
/** Load the four essentials within the existing one-minute screen, capped below the server's six leases.
 * Deadline and auth/rate-limit failures cancel work; no retries inflate the budget.
 */
export function startPreparation(options:{fetch:(row:ConnectedRequest,signal:AbortSignal)=>Promise<{ok:boolean;fatal?:boolean;error?:string;kind?:'restricted'|'not_applicable'|'failed'}>;onProgress:(value:PreparationProgress)=>void;onComplete:(value:PreparationResult)=>void;now?:()=>number}){
 const now=options.now??Date.now,start=now(),controller=new AbortController(),plan=preparationPlan();
 let state=emptyProgress(),next=0,closed=false,halted=false;
 const emit=()=>options.onProgress({...state});
 const finish=()=>{if(closed)return;closed=true;clearInterval(pump);clearTimeout(deadline);controller.abort();options.onComplete({...state,active:0,finishedAt:now()});};
 const launch=()=>{
  if(closed||halted)return;
  if(now()-start>=PREPARATION_MS){finish();return;}
  if(state.active>=5||next>=plan.length||now()-start<next*600)return;
  const row=plan[next++];state={...state,started:next,active:state.active+1,current:`Loading ${row.label.toLowerCase()}`};emit();
  void options.fetch(row,controller.signal).then(result=>{
   if(closed)return;
   state={...state,active:state.active-1,loaded:state.loaded+(result.ok?1:0),failed:state.failed+(result.ok?0:1),issues:result.ok?state.issues:[...state.issues,{endpoint:row.capability.id,label:`${row.capability.group.charAt(0).toUpperCase()+row.capability.group.slice(1)} · ${row.label}`,reason:result.error??'No data was returned.',kind:result.kind??'failed'}]};
   if(next===plan.length&&state.active===0&&!result.fatal)state.current='Dashboard essentials prepared';
   if(result.fatal){halted=true;state.problem=result.error??'Some data could not be loaded.';controller.abort();}
   emit();
  }).catch(error=>{
   if(closed)return;
   state={...state,active:Math.max(0,state.active-1),failed:state.failed+1,issues:[...state.issues,{endpoint:row.capability.id,label:`${row.capability.group.charAt(0).toUpperCase()+row.capability.group.slice(1)} · ${row.label}`,reason:error instanceof Error?error.message:'Request failed.',kind:'failed'}]};
   if(!controller.signal.aborted)state.problem=error instanceof Error?error.message:'A data request failed.';
   emit();
  });
 };
 const pump=setInterval(launch,50),deadline=setTimeout(finish,PREPARATION_MS);
 launch();
 return {cancel:()=>{closed=true;clearInterval(pump);clearTimeout(deadline);controller.abort();},startedAt:start};
}
// Explicit mapping avoids broken generic endpoints and missing lookup parameters.
export const PAGE_DATA:Record<string,string[]>={
 Stocks:['/user/stocks','/torn/stocks'],Company:['/company/profile','/company/employees','/company/stock'],Properties:['/user/properties','/user/property'],Markets:['/user/inventory','/market/pointsmarket'],Travel:['/user/travel'], 'Travel Optimizer':['/user/travel'], 'Flight Tracker':['/user/travel'],Gym:['/user/gym','/user/battlestats'], 'Crime Tracker':['/user/skills','/user/personalstats'], 'OC Planner':['/user/organizedcrime','/faction/crimes'], 'War Hits':['/user/attacks'],Bounties:['/user/bounties'],Racing:['/user/races','/user/racingrecords'], 'Stat Intelligence':['/user/personalstats','/user/battlestats'], 'Stat Growth':['/user/personalstats'],Faction:['/faction/basic','/faction/members','/faction/chain'], 'Faction Finance':['/faction/balance'], 'Faction Upgrades':['/faction/upgrades'], 'Armory History':['/faction/news'],Notifications:['/user/notifications'],Activity:['/user/events'], 'Custom Stats':['/user/personalstats'], 'Daily Digest':['/user/bars','/user/cooldowns'], 'Planner':['/user/battlestats','/user/workstats'], 'Revive Tracker':['/user/revives'], 'War Room':['/faction/chain','/faction/members'], 'Recruitment':['/faction/basic'], 'Watched Factions':['/faction/basic'], 'Halloween':['/user/competition']
};
export function pageDatasets(page:string){return (PAGE_DATA[page]??[]).flatMap(path=>{const endpoint=CAPABILITIES.find(c=>c.path===path);return endpoint?[endpoint]:[];});}
