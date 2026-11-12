import {adminClient,authenticate,json,preflight,checked} from '../_shared/http.ts';
import {resolveRefreshKey,refreshFailure} from '../_shared/live-refresh.ts';
import {budgetedTornFetch} from '../_shared/torn-budget.ts';
import {tornGet} from '../_shared/torn.ts';
import {activeOpponents,rosterTargets,validateSelection,authorizeAssignee,positiveId} from '../_shared/war-targets.ts';
Deno.serve(async(req)=>{
 const early=preflight(req);if(early)return early;
 const admin=adminClient(),user=await authenticate(req,admin);if(!user)return json({error:'Sign in to manage war targets.'},401);
 try{
  const body=await req.json();if(!['load','save','refresh','alerts'].includes(body.action))return json({error:'Unknown war target action.'},400);
  const linked=checked(await admin.from('linked_torn_accounts').select('torn_id').eq('user_id',user.id).is('revoked_at',null).maybeSingle()).data;
  if(!linked)return json({error:'Link your Torn identity first.'},409);
  const actorId=Number(linked.torn_id);
  const profile=checked(await admin.from('profiles').select('tracking_paused').eq('id',user.id).single()).data;
  if(profile.tracking_paused)return json({error:'Resume tracking in Settings to use war targets.'},409);
  let saved=checked(await admin.from('war_target_lists').select('*').eq('user_id',user.id).maybeSingle()).data;
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
  const membership=await get('/user/faction'),factionId=membership.faction?.id;
  if(!positiveId(factionId)){
   if(saved)checked(await admin.from('war_target_lists').update({active:false,targets:[],verified_until:new Date().toISOString()}).eq('user_id',user.id));
   return json({error:'You must currently belong to a faction.'},403);
  }
  const wars=activeOpponents(await get('/faction/wars'),factionId);
  const assigneeId=body.action==='refresh'?actorId:body.assignee_id??actorId;
  let leaderId=actorId,canManage=false,members:ReturnType<typeof rosterTargets>=[];
  if(body.action!=='refresh'){
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
  const warKey=body.action==='refresh'?saved?.war_key:body.war_key??saved?.war_key;
  const opponent=wars.find(w=>w.key===warKey)??(body.action==='load'&&!body.war_key?wars[0]:undefined);
  if(!opponent){
   if(body.action==='refresh'&&saved)checked(await admin.from('war_target_lists').update({active:false,targets:[],verified_until:new Date().toISOString()}).eq('user_id',owner).eq('revision',saved.revision));
   if(body.action==='save')return json({error:'Choose a current active faction war.'},409);
   return json({actor_id:actorId,faction_id:factionId,can_manage:canManage,members,wars,enemies:[],list:null,war_key:null,assignment_revision:saved?.revision??null,assignee_id:assigneeId});
  }
  const enemies=rosterTargets(await get(`/faction/${opponent.id}/members`));
  if(body.action==='save'){
   const ids=validateSelection(body.target_ids,enemies);
   const expected=body.expected_revision??null;
   if(expected!==(saved?.revision??null))return json({error:'Assignments changed. Reload before saving.'},409);
   const row={user_id:owner,faction_id:factionId,war_key:opponent.key,enemy_faction_id:opponent.id,target_ids:ids,targets:enemies.filter(m=>ids.includes(m.id)),active:true,updated_by:actorId,revision:(saved?.revision??0)+1,verified_until:new Date(Date.now()+120000).toISOString(),updated_at:new Date().toISOString()};
   const result=saved?await admin.from('war_target_lists').update(row).eq('user_id',owner).eq('revision',saved.revision).select().maybeSingle():await admin.from('war_target_lists').insert(row).select().single();
   checked(result);if(!result.data)return json({error:'Assignments changed. Reload before saving.'},409);saved=result.data;
  }else if(saved&&saved.war_key===opponent.key&&saved.faction_id===factionId){
   const targets=enemies.filter(m=>(saved.target_ids as number[]).includes(m.id));
   checked(await admin.from('war_target_lists').update({targets,verified_until:new Date(Date.now()+120000).toISOString(),updated_at:new Date().toISOString(),revision:saved.revision+1}).eq('user_id',owner).eq('revision',saved.revision));
   saved=checked(await admin.from('war_target_lists').select('*').eq('user_id',owner).maybeSingle()).data;
  }
  return json(body.action==='refresh'?{list:saved}:{actor_id:actorId,faction_id:factionId,can_manage:canManage,members,wars,enemies,war_key:opponent.key,assignment_revision:saved?.revision??null,list:saved?.war_key===opponent.key&&saved.faction_id===factionId?saved:null,assignee_id:assigneeId});
 }catch(error){
  const failure=refreshFailure(error);
  return json({error:error instanceof Error&&!(error as any).code?error.message:failure.error},failure.status);
 }
});
