import {adminClient,authenticate,scheduled,json,preflight} from '../_shared/http.ts';
import {resolveRefreshKey} from '../_shared/live-refresh.ts';
import {budgetedTornFetch} from '../_shared/torn-budget.ts';
import {compileTornRequest,fetchTornPage,requestHash} from '../_shared/torn-data.ts';
import {AUTOMATIC_TIMER_ENDPOINTS,runTimerJob,type TimerJob} from '../_shared/timer-events.ts';
Deno.serve(async(req)=>{
 const early=preflight(req);if(early)return early;
 try{
  const admin=adminClient(),job=await scheduled(req,admin),user=job?null:await authenticate(req,admin);
  if(!job&&!user)return json({error:'Unauthorized'},401);
  const claimed=await admin.rpc('claim_timer_jobs',{requested_owner:user?.id??null});if(claimed.error)throw claimed.error;
  let processed=0;const deadline=Date.now()+45000;
  for(const task of (claimed.data??[]) as TimerJob[]){
   if(Date.now()>deadline)break;
   const baselines=await admin.from('torn_timer_baselines').select('endpoint_id,payload,observed_at,deadlines').eq('user_id',task.user_id).in('endpoint_id',[...AUTOMATIC_TIMER_ENDPOINTS]);
   if(baselines.error)throw baselines.error;
   let key:string|undefined;
   const load=async(endpoint:string,parameters:Record<string,string>)=>{
    if(Date.now()>deadline)throw new Error('Timer job time budget reached.');
    key??=await resolveRefreshKey(admin,task.user_id,undefined,Deno.env.get('TORN_KEY_ENCRYPTION_KEY'));
    const compiled=compileTornRequest(endpoint,parameters);
    return await fetchTornPage(compiled.path,key,budgetedTornFetch(admin,task.user_id));
   };
   const result=await runTimerJob(task,{baselines:baselines.data??[],loadLogs:params=>load('v2-user-log',params),refresh:async endpoint=>{
    const parameters:Record<string,string>={},payload=await load(endpoint,parameters);
    const saved=await admin.rpc('store_torn_data',{owner_id:task.user_id,hash:await requestHash(endpoint,parameters),endpoint,params:parameters,observation:payload});if(saved.error)throw saved.error;
   }});
   const finished=await admin.rpc('finish_timer_job',{owner_id:task.user_id,job_token:task.token,result});if(finished.error)throw finished.error;
   processed++;
  }
  return json({processed,source:'incremental activity logs and saved timer deadlines'});
 }catch{return json({error:'Timer log tracking is temporarily unavailable.'},503);}
});
