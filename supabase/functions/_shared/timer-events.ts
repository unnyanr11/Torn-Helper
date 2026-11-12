export const TIMER_ENDPOINTS=['v2-user-bars','v2-user-cooldowns','v2-user-travel','v2-user-education','v2-user-organizedcrime','v2-user-races','v2-user-profile','v2-faction-chain'] as const;
export const AUTOMATIC_TIMER_ENDPOINTS=['v2-user-profile','v2-user-bars','v2-user-cooldowns','v2-user-travel'] as const;
export const isAutomaticTimerEndpoint=(id:string)=>(AUTOMATIC_TIMER_ENDPOINTS as readonly string[]).includes(id);
export type TimerEndpoint=typeof TIMER_ENDPOINTS[number];
export const isTimerEndpoint=(id:string):id is TimerEndpoint=>(TIMER_ENDPOINTS as readonly string[]).includes(id);
export type TimerBaseline={endpoint_id:string;payload:any;observed_at:string;deadlines:Record<string,number>};
/** Logs invalidate a baseline; no guessed item durations or costs are applied. */
export function affectedTimerEndpoints(event:any):TimerEndpoint[]{
 const title=typeof event?.details?.title==='string'?event.details.title:'';
 const data=event?.data&&typeof event.data==='object'?event.data:{};
 const fields=Object.keys(data).join(' '),targets=new Set<TimerEndpoint>();
 const add=(...ids:TimerEndpoint[])=>ids.forEach(id=>targets.add(id));
 if(/drug|overdose|rehab|medical|blood bag|hospital|reviv|booster|energy drink|alcohol|candy|consum|item use|item equip/i.test(title)||/cooldown|medical|drug|booster/i.test(fields))add('v2-user-cooldowns','v2-user-bars','v2-user-profile');
 if(/travel|flight|fly |landing|landed|arrival|abroad|return to torn/i.test(title))add('v2-user-travel','v2-user-profile');
 if(/education|course/i.test(title))add('v2-user-education','v2-user-bars');
 if(/organized crime|organised crime|\bOC\b/i.test(title))add('v2-user-organizedcrime','v2-user-bars');
 if(/racing|race (join|start|finish|leave|crash|complete)/i.test(title))add('v2-user-races');
 if(/gym|train|attack|defend|mug|hunting|reviv|crime|refill|donator|subscriber|company special|job point|book/i.test(title)||/energy|nerve|happy|happiness|life/i.test(fields))add('v2-user-bars');
 if(/attack|defend|mug|hospital|jail|bail|arrest|escape|release|reviv/i.test(title))add('v2-user-profile');
 if(/attack|chain/i.test(title))add('v2-faction-chain');
 return [...targets];
}
export function eventIsNewFor(event:any,baseline:TimerBaseline){
 return typeof event?.id==='string'&&event.id.length>0&&Number.isSafeInteger(event.timestamp)&&event.timestamp>=Math.floor(Date.parse(baseline.observed_at)/1000);
}
/** Preserve the descending log window and Torn's nanosecond cursor. Never follow arbitrary URLs. */
export function nextTimerLogParameters(payload:any,current:Record<string,string>):Record<string,string>|null{
 if(!Array.isArray(payload?.log)||!payload?._metadata?.links)throw new Error('Log coverage metadata is missing.');
 const links=payload._metadata.links;
 const link=Object.prototype.hasOwnProperty.call(links,'prev')?links.prev:links.next;
 if(link===undefined)throw new Error('Log pagination is missing.');
 let url:URL|null=null;
 if(link!==null){if(typeof link!=='string')throw new Error('Unsupported log continuation.');url=new URL(link,'https://api.torn.com');if(url.origin!=='https://api.torn.com'||url.pathname!=='/v2/user/log')throw new Error('Unsafe log continuation.');}
 const full=payload.log.length>=Number(current.limit??100),cursor=url?.searchParams.get('nanostamp')??payload._metadata.nanostamp;
 if(link===null&&!full)return null;
 const next={...current};
 if(cursor!=null){if(typeof cursor!=='string'||!/^\d{1,30}$/.test(cursor)||cursor===current.nanostamp)throw new Error('Invalid or repeated log cursor.');next.nanostamp=cursor;delete next.to;}
 else if(url){const to=url.searchParams.get('to');if(!to||!/^\d+$/.test(to)||Number(to)>Number(current.to)||Number(to)<Number(current.from))throw new Error('Invalid log continuation boundary.');next.to=to;}
 else throw new Error('A full log page has no continuation.');
 if(JSON.stringify(next)===JSON.stringify(current))throw new Error('Repeated log continuation.');
 return next;
}
export type TimerJob={user_id:string;token:string;cursor_to:number;scan_to:number|null;next_parameters:Record<string,string>|null;pending_endpoints:string[]};
export type TimerJobResult={cursor_to:number;scan_to:number|null;next_parameters:Record<string,string>|null;pending_endpoints:string[];error:string|null;retry_seconds:number};
/** Two pages/job, one refresh per affected endpoint, and durable unfinished work. */
export async function runTimerJob(job:TimerJob,deps:{baselines:TimerBaseline[];loadLogs:(params:Record<string,string>)=>Promise<any>;refresh:(endpoint:TimerEndpoint)=>Promise<void>;now?:number}):Promise<TimerJobResult>{
 const to=job.scan_to??Math.floor((deps.now??Date.now())/1000)-5;
 let params=job.next_parameters??{from:String(Math.max(0,job.cursor_to-1)),to:String(to),limit:'100'};
 const pending=new Set(job.pending_endpoints.filter(isTimerEndpoint).filter(isAutomaticTimerEndpoint));
 let next:Record<string,string>|null=params,complete=false;
 try{
  for(let page=0;page<2&&next;page++){
   const current=next,payload=await deps.loadLogs(current);
   if(!Array.isArray(payload?.log))throw new Error('Unsupported log response.');
   for(const event of payload.log){
    if(!Number.isSafeInteger(event.timestamp)||event.timestamp>to||event.timestamp<job.cursor_to-1)continue;
    for(const target of affectedTimerEndpoints(event)){
     if(!isAutomaticTimerEndpoint(target))continue;
     const baseline=deps.baselines.find(row=>row.endpoint_id===target);
     if(baseline&&eventIsNewFor(event,baseline))pending.add(target);
    }
   }
   next=nextTimerLogParameters(payload,current);complete=next===null;
  }
 }catch(error){
  const code=(error as any)?.code;
  const denied=[2,7,10,13,16,18].includes(code),quota=[5,8,14].includes(code)||(error as any)?.httpStatus===429;
  return {cursor_to:job.cursor_to,scan_to:to,next_parameters:next,pending_endpoints:[...pending],error:denied?'Log tracking is unavailable for this key. Saved countdowns continue; check key permissions.':quota?'Log checks are waiting for the shared Torn quota.':'Log coverage is incomplete; saved countdowns remain estimates.',retry_seconds:denied?3600:120};
 }
 let error:string|null=null;
 for(const endpoint of [...pending]){
  try{await deps.refresh(endpoint);pending.delete(endpoint);}catch{error='An affected timer needs a retry. The last saved countdown remains an estimate.';}
 }
 return {cursor_to:complete?to:job.cursor_to,scan_to:complete?null:to,next_parameters:next,pending_endpoints:[...pending],error,retry_seconds:60};
}
