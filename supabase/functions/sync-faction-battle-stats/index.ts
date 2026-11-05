import {adminClient,scheduled,preflight,json} from '../_shared/http.ts';
import {resolveRefreshKey} from '../_shared/live-refresh.ts';
import {compileTornRequest,fetchTornPage,requestHash} from '../_shared/torn-data.ts';
import {runBattleJob,type BattleJob} from '../_shared/faction-battle-worker.ts';
Deno.serve(async(req)=>{
 const early=preflight(req);if(early)return early;
 try{
  const admin=adminClient();if(!await scheduled(req,admin))return json({error:'Unauthorized'},401);
  const jobs=await admin.rpc('claim_faction_battle_jobs');if(jobs.error)throw jobs.error;
  let updated=0,paused=0,skipped=0;const deadline=Date.now()+45000;
  for(const job of (jobs.data??[]) as BattleJob[]){
   if(Date.now()>deadline)break; // Unprocessed leases expire; subsequent cron ticks resume them.
   let key:string|undefined;
   const act=async(action:string,parameters:Record<string,string>={},failure?:string)=>{
    const r=await admin.rpc('faction_battle_worker',{owner_id:job.user_id,token:job.token,action,parameters,failure:failure??null});if(r.error)throw r.error;return r.data;
   };
   const result=await runBattleJob(job,{act,load:async(endpoint,parameters={},fresh=false)=>{
    const hash=await requestHash(endpoint,parameters);
    if(!fresh){const saved=await admin.from('torn_data_cache').select('fetched_at').eq('user_id',job.user_id).eq('request_hash',hash).maybeSingle();if(saved.error)throw saved.error;if(saved.data&&Date.now()-Date.parse(saved.data.fetched_at)<60000)return;}
    const budget=await admin.rpc('consume_torn_data_budget',{owner_id:job.user_id,cost:1});if(budget.error||budget.data!==true)throw new Error('Budget unavailable');
    key??=await resolveRefreshKey(admin,job.user_id,undefined,Deno.env.get('TORN_KEY_ENCRYPTION_KEY'));
    const compiled=compileTornRequest(endpoint,parameters);
    // Reconciliation alone bypasses upstream stat caching; the stored record remains a current baseline.
    const path=fresh?compiled.path+(compiled.path.includes('?')?'&':'?')+'timestamp='+Math.floor(Date.now()/1000):compiled.path;
    const payload=await fetchTornPage(path,key);
    const r=await admin.rpc('store_torn_data',{owner_id:job.user_id,hash,endpoint,params:parameters,observation:payload});if(r.error)throw r.error;
   }});
   if(result==='updated')updated++;else if(result==='paused')paused++;else skipped++;
  }
  return json({updated,paused,skipped});
 }catch{return json({error:'Unable to run automatic faction-stat updates.'},503);}
});
