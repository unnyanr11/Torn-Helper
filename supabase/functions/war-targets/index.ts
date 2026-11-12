import {adminClient,authenticate,json,preflight,checked} from '../_shared/http.ts';
import {resolveRefreshKey,refreshFailure} from '../_shared/live-refresh.ts';
import {budgetedTornFetch} from '../_shared/torn-budget.ts';
import {tornGet} from '../_shared/torn.ts';
import {activeOpponents,rosterTargets,validateSelection,authorizeAssignee,positiveId,validPriorities,validAlertPreferences} from '../_shared/war-targets.ts';
import {attackRecords,attackNext,mergeWarAttacks} from '../_shared/war-reports.ts';
Deno.serve(async(req)=>{
 const early=preflight(req);if(early)return early;
 const admin=adminClient(),user=await authenticate(req,admin);if(!user)return json({error:'Sign in to manage war targets.'},401);
 try{
  const body=await req.json();if(!['load','save','refresh','alerts','preferences','claim','release','prealert','report','report_sync','claim_sync'].includes(body.action))return json({error:'Unknown war target action.'},400);
  const linked=checked(await admin.from('linked_torn_accounts').select('torn_id,torn_name').eq('user_id',user.id).is('revoked_at',null).maybeSingle()).data;
  if(!linked)return json({error:'Link your Torn identity first.'},409);
  const actorId=Number(linked.torn_id);
  const profile=checked(await admin.from('profiles').select('tracking_paused').eq('id',user.id).single()).data;
  if(profile.tracking_paused)return json({error:'Resume tracking in Settings to use war targets.'},409);
  let saved=checked(await admin.from('war_target_lists').select('*').eq('user_id',user.id).maybeSingle()).data;
  if(body.action==='preferences'){
   const preferences=validAlertPreferences(body.preferences);checked(await admin.from('war_alert_preferences').upsert({user_id:user.id,...preferences}));return json({preferences});
  }
  if(body.action==='release'){
   if(!positiveId(body.target_id))return json({error:'Choose a target.'},400);
   checked(await admin.from('war_target_claims').delete().eq('user_id',user.id).eq('target_id',body.target_id));return json({released:true});
  }
  if(body.action==='report'){
   const reports=checked(await admin.from('war_reports').select('*').eq('user_id',user.id).order('war_start',{ascending:false}).limit(30)).data;
   const report=reports?.find(r=>r.war_key===(body.war_key??saved?.war_key))??reports?.[0]??null;
   const events=report?checked(await admin.from('war_events').select('*').eq('user_id',user.id).eq('war_key',report.war_key).order('created_at').limit(1001)).data:[];
   return json({reports,report,events:events?.slice(0,1000),events_partial:(events?.length??0)>1000});
  }
  // Alert preference changes are owner-only and never trigger an upstream call.
  if(body.action==='alerts'){
   if(typeof body.enabled!=='boolean')return json({error:'Choose an alert preference.'},400);
   const result=checked(await admin.from('war_target_lists').update({alerts_enabled:body.enabled}).eq('user_id',user.id).select().maybeSingle()).data;
   return json({list:result});
  }
  if(body.action==='refresh'&&(!saved||!saved.active||!saved.target_ids.length||!saved.alerts_enabled))return json({list:saved});
  // Repeated tabs/reconnects reuse the most recent saved snapshot for 30 seconds.
  if(body.action==='refresh'&&Date.parse(saved.updated_at)>Date.now()-30000)return json({list:saved});
  const key=await resolveRefreshKey(admin,user.id,undefined,Deno.env.get('TORN_KEY_ENCRYPTION_KEY'));
  const fetcher=budgetedTornFetch(admin,user.id),get=(path:string)=>tornGet(path,key,fetcher);
  const syncClaims=async()=>{
   const claims=checked(await admin.from('war_target_claims').select('*').eq('user_id',user.id).gt('expires_at',new Date().toISOString())).data??[];
   if(!claims.length)return;
   const ids=claims.map(c=>c.claim_id).sort();
   let params=checked(await admin.rpc('war_claim_scan',{owner_id:user.id,ids})).data??{from:String(Math.floor(Math.min(...claims.map(c=>Date.parse(c.claimed_at)))/1000)),to:String(Math.floor(Date.now()/1000)),limit:'100',sort:'ASC',filters:'outgoing'};
   const records=[];
   for(let page=0;page<2&&params;page++){
    const payload=await get('/user/attacks?'+new URLSearchParams(params));records.push(...attackRecords(payload,actorId,Number(params.from),Number(params.to)));params=attackNext(payload,params);
   }
   checked(await admin.rpc('record_war_claim_attacks',{owner_id:user.id,records}));
   checked(await admin.rpc('war_claim_scan',{owner_id:user.id,ids,next_value:params,save_value:true}));
  };
  if(body.action==='claim_sync'){await syncClaims();return json({checked:true});}
  if(body.action==='report_sync'){
   const report=checked(await admin.from('war_reports').select('*').eq('user_id',user.id).eq('war_key',body.war_key).maybeSingle()).data;
   if(!report)return json({error:'Choose a recorded war.'},404);
   // A ranked war report supplies an authoritative end time even after /wars removes it.
   if(!report.war_end&&report.war_key.startsWith('ranked:')){
    const id=Number(report.war_key.split(':')[1]);if(!positiveId(id))return json({error:'Invalid recorded war.'},400);
    const official=(await get(`/faction/${id}/rankedwarreport`)).rankedwarreport;
    if(official?.id!==id||!official.factions?.some(f=>f.id===report.faction_id)||!Number.isSafeInteger(official.start))return json({error:'War report verification failed.'},409);
    report.war_start=official.start;report.war_end=positiveId(official.end)?official.end:null;
   }
   let params=report.next_parameters??{from:String(report.war_start),to:String(report.war_end??Math.floor(Date.now()/1000)),limit:'100',sort:'ASC',filters:'outgoing'};
   let records=report.attacks??[];
   for(let page=0;page<2&&params;page++){
    const payload=await get('/user/attacks?'+new URLSearchParams(params));records=mergeWarAttacks(records,attackRecords(payload,actorId,report.war_start,Number(params.to),report.enemy_faction_id,report.war_key.split(':')[0],Number(report.war_key.split(':')[1])));params=attackNext(payload,params);
   }
   checked(await admin.from('war_reports').update({attacks:records,next_parameters:params,war_start:report.war_start,war_end:report.war_end,coverage:params?'partial':report.war_end?'complete':'end_unconfirmed',updated_at:new Date().toISOString()}).eq('user_id',user.id).eq('war_key',report.war_key));
   return json({synced:true,more:!!params});
  }
  if(body.action==='prealert'){
   if(!saved?.active||!saved.alerts_enabled||Date.parse(saved.verified_until)<=Date.now())return json({list:saved});
   const target=saved.targets.find(t=>t.id===body.target_id&&saved.target_ids.includes(t.id)&&t.state==='Hospital');
   const prefs=checked(await admin.from('war_alert_preferences').select('*').eq('user_id',user.id).maybeSingle()).data;
   const lead=prefs?.lead_seconds??20;
   if(!target?.hospital_until||target.hospital_until*1000<=Date.now()||target.hospital_until*1000-Date.now()>(lead+15)*1000)return json({list:saved});
   const checkId=`${saved.war_key}:${target.id}:${target.hospital_until}:${lead}`;
   if(checked(await admin.rpc('begin_war_prealert',{owner_id:user.id,check_id:checkId})).data!==true)return json({list:saved});
   const targets=rosterTargets(await get(`/faction/${saved.enemy_faction_id}/members`)).filter(t=>saved.target_ids.includes(t.id));
   checked(await admin.from('war_target_lists').update({targets,updated_at:new Date().toISOString()}).eq('user_id',user.id).eq('revision',saved.revision));
   return json({checked:true});
  }
  const membership=await get('/user/faction'),factionId=membership.faction?.id;
  if(!positiveId(factionId)){
   if(saved)checked(await admin.from('war_target_lists').update({active:false,targets:[],verified_until:new Date().toISOString()}).eq('user_id',user.id));
   return json({error:'You must currently belong to a faction.'},403);
  }
  checked(await admin.rpc('verify_war_membership',{owner_id:user.id,faction:factionId,identity:actorId}));
  const warPayload=await get('/faction/wars');
  const wars=activeOpponents(warPayload,factionId);
  const assigneeId=['refresh','claim'].includes(body.action)?actorId:body.assignee_id??actorId;
  let leaderId=actorId,canManage=false,members:ReturnType<typeof rosterTargets>=[];
  if(!['refresh','claim'].includes(body.action)){
   const basic=(await get('/faction/basic')).basic;
   if(basic?.id!==factionId||!positiveId(basic?.leader_id))return json({error:'Faction identity verification failed.'},403);
   leaderId=basic.leader_id;canManage=leaderId===actorId;
   if(canManage){members=rosterTargets(await get('/faction/members'));}
   authorizeAssignee(actorId,assigneeId,leaderId,members);
  }
  let owner=user.id;
  if(assigneeId!==actorId){
   const assignee=checked(await admin.from('linked_torn_accounts').select('user_id').eq('torn_id',assigneeId).is('revoked_at',null).maybeSingle()).data;
   if(!assignee)return json({error:'This member needs to sign in and link their Torn account before receiving assignments.'},409);
   owner=assignee.user_id;
   saved=checked(await admin.from('war_target_lists').select('*').eq('user_id',owner).maybeSingle()).data;
  }
  const warKey=['refresh','claim'].includes(body.action)?saved?.war_key:body.war_key??saved?.war_key;
  const opponent=wars.find(w=>w.key===warKey)??(body.action==='load'&&!body.war_key?wars[0]:undefined);
  if(!opponent){
   if(body.action==='refresh'&&saved)checked(await admin.from('war_target_lists').update({active:false,targets:[],verified_until:new Date().toISOString()}).eq('user_id',owner).eq('revision',saved.revision));
   if(['save','claim'].includes(body.action))return json({error:'Choose a current active faction war.'},409);
   return json({actor_id:actorId,faction_id:factionId,can_manage:canManage,members,wars,enemies:[],list:null,war_key:null,assignment_revision:saved?.revision??null,assignee_id:assigneeId});
  }
  const enemies=rosterTargets(await get(`/faction/${opponent.id}/members`));
  if(body.action==='claim'){
   if(!Number.isInteger(body.attacks_goal??1)||(body.attacks_goal??1)<1||(body.attacks_goal??1)>100)return json({error:'Choose between 1 and 100 attacks.'},400);
   if(!saved?.active||!saved.target_ids.includes(body.target_id)||!enemies.some(t=>t.id===body.target_id))return json({error:'Choose one of your current assigned targets.'},403);
   const result=checked(await admin.rpc('take_war_target',{owner_id:user.id,target:body.target_id,attack_goal:body.attacks_goal??1}));return json({claim:result.data});
  }
  if(body.action==='save'){
   const ids=validateSelection(body.target_ids,enemies),priorities=validPriorities(body.priorities,ids);
   const expected=body.expected_revision??null;
   if(expected!==(saved?.revision??null))return json({error:'Assignments changed. Reload before saving.'},409);
   const row={user_id:owner,faction_id:factionId,war_key:opponent.key,enemy_faction_id:opponent.id,target_ids:ids,priorities,war_start:opponent.start,war_end:null,targets:enemies.filter(m=>ids.includes(m.id)),active:true,updated_by:actorId,revision:(saved?.revision??0)+1,verified_until:new Date(Date.now()+120000).toISOString(),updated_at:new Date().toISOString()};
   const result=saved?await admin.from('war_target_lists').update(row).eq('user_id',owner).eq('revision',saved.revision).select().maybeSingle():await admin.from('war_target_lists').insert(row).select().single();
   checked(result);if(!result.data)return json({error:'Assignments changed. Reload before saving.'},409);saved=result.data;
  }else if(saved&&saved.war_key===opponent.key&&saved.faction_id===factionId){
   const targets=enemies.filter(m=>(saved.target_ids as number[]).includes(m.id));
   checked(await admin.from('war_target_lists').update({targets,war_start:opponent.start,verified_until:new Date(Date.now()+120000).toISOString(),updated_at:new Date().toISOString(),revision:saved.revision+1}).eq('user_id',owner).eq('revision',saved.revision));
   saved=checked(await admin.from('war_target_lists').select('*').eq('user_id',owner).maybeSingle()).data;
  }
  let board=[],history=[];
  if(canManage){
   const currentIds=members.map(m=>m.id);
   const linkedMembers=checked(await admin.from('linked_torn_accounts').select('user_id,torn_id').in('torn_id',currentIds).is('revoked_at',null)).data??[];
   const owners=linkedMembers.map(m=>m.user_id);
   if(owners.length){
    const assignments=checked(await admin.from('war_target_lists').select('user_id,target_ids,priorities,updated_by,updated_at,war_key,revision').eq('faction_id',factionId).eq('war_key',opponent.key).in('user_id',owners)).data??[];
    board=members.map(m=>({id:m.id,name:m.name,linked:linkedMembers.some(a=>a.torn_id===m.id),assignment:assignments.find(a=>linkedMembers.some(l=>l.user_id===a.user_id&&l.torn_id===m.id))??null}));
    const events=checked(await admin.from('war_events').select('user_id,actor_torn_id,kind,details,created_at').eq('faction_id',factionId).eq('war_key',opponent.key).eq('kind','assignment').in('user_id',owners).order('created_at',{ascending:false}).limit(100)).data??[];
    history=events.map(e=>({...e,member_id:linkedMembers.find(m=>m.user_id===e.user_id)?.torn_id,user_id:undefined}));
   }
  }
  return json(body.action==='refresh'?{list:saved}:{actor_id:actorId,faction_id:factionId,can_manage:canManage,members,wars,enemies,board,history,war_key:opponent.key,assignment_revision:saved?.revision??null,list:saved?.war_key===opponent.key&&saved.faction_id===factionId?saved:null,assignee_id:assigneeId});
 }catch(error){
  if((error as any)?.code==='P0001'&&typeof (error as any).message==='string')return json({error:(error as any).message},409);
  const failure=refreshFailure(error);
  return json({error:error instanceof Error&&!(error as any).code?error.message:failure.error},failure.status);
 }
});
