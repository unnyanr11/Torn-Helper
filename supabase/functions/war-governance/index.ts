import {adminClient,authenticate,json,preflight,checked} from '../_shared/http.ts';
import {resolveRefreshKey,refreshFailure} from '../_shared/live-refresh.ts';
import {budgetedTornFetch} from '../_shared/torn-budget.ts';
import {tornGet} from '../_shared/torn.ts';
import {activeOpponents,rosterTargets,positiveId} from '../_shared/war-targets.ts';
Deno.serve(async req=>{
 const early=preflight(req);if(early)return early;
 const admin=adminClient(),user=await authenticate(req,admin);if(!user)return json({error:'Sign in to coordinate war targets.'},401);
 try{
  const raw=await req.json(),body=Object.fromEntries(['action','war_key','target_id','attacks_goal','member_id','max_attacks','enabled','mode','override','reason','request_id','swap','accept'].filter(k=>raw[k]!==undefined).map(k=>[k,raw[k]])),actions=['verify','poll','queue','leave_queue','propose','respond','handler','policy','rule'];
  if(!actions.includes(body.action))return json({error:'Unknown coordination action.'},400);
  if(body.action==='respond'&&typeof body.accept!=='boolean')return json({error:'Choose accept or decline.'},400);
  if(body.action==='handler'&&typeof body.enabled!=='boolean')return json({error:'Choose appoint or remove.'},400);
  const command=body.action==='poll'?'snapshot':body.action;
  const linked=checked(await admin.from('linked_torn_accounts').select('torn_id').eq('user_id',user.id).is('revoked_at',null).maybeSingle()).data;
  if(!linked)return json({error:'Link your Torn identity first.'},409);
  if(command==='snapshot'||command==='leave_queue'||command==='respond'&&body.accept===false){
   const result=checked(await admin.rpc('war_governance',{owner_id:user.id,command,body}));
   if(command==='snapshot')return json(result.data);
   const snapshot=await admin.rpc('war_governance',{owner_id:user.id,command:'snapshot',body:{}});
   return json(snapshot.error?{changed:true,needs_verification:true}:snapshot.data);
  }
  const profile=checked(await admin.from('profiles').select('tracking_paused').eq('id',user.id).single()).data;
  if(profile.tracking_paused)return json({error:'Resume tracking before verifying war coordination.'},409);
  const saved=checked(await admin.from('war_target_lists').select('war_key,target_ids,revision,faction_id').eq('user_id',user.id).maybeSingle()).data;
  const key=await resolveRefreshKey(admin,user.id,undefined,Deno.env.get('TORN_KEY_ENCRYPTION_KEY'));
  const fetcher=budgetedTornFetch(admin,user.id),get=(path:string)=>tornGet(path,key,fetcher);
  const faction=(await get('/user/faction')).faction?.id;if(!positiveId(faction))return json({error:'You must currently belong to a faction.'},403);
  const [basicPayload,rosterPayload,warsPayload]=await Promise.all([get('/faction/basic'),get('/faction/members'),get('/faction/wars')]);
  const basic=basicPayload.basic,roster=rosterTargets(rosterPayload),actorId=Number(linked.torn_id);
  if(basic?.id!==faction||!positiveId(basic?.leader_id)||!roster.some(m=>m.id===actorId))return json({error:'Current faction and leadership verification failed.'},403);
  const wars=activeOpponents(warsPayload,faction),opponent=wars.find(w=>w.key===(body.war_key??saved?.war_key))??(body.action==='verify'?wars[0]:undefined);
  if(!opponent)return json({error:'Choose a current active faction war.'},409);
  const targets=rosterTargets(await get(`/faction/${opponent.id}/members`));
  checked(await admin.rpc('verify_war_command',{owner_id:user.id,faction,war:opponent.key,identity:actorId,leader:basic.leader_id,roster:roster.map(m=>m.id),enemy:opponent.id,targets,started:opponent.start}));
  if(saved?.war_key===opponent.key&&Number(saved.faction_id)===faction){
   checked(await admin.from('war_target_lists').update({targets:targets.filter(t=>saved.target_ids.includes(t.id)),verified_until:new Date(Date.now()+120000).toISOString(),updated_at:new Date().toISOString()}).eq('user_id',user.id).eq('revision',saved.revision));
  }
  if(body.action!=='verify')checked(await admin.rpc('war_governance',{owner_id:user.id,command,body}));
  return json(checked(await admin.rpc('war_governance',{owner_id:user.id,command:'snapshot',body:{}})).data);
 }catch(error){
  if((error as any)?.code==='P0001')return json({error:(error as any).message},409);
  const failure=refreshFailure(error);return json({error:failure.error},failure.status);
 }
});
