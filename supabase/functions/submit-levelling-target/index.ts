import {adminClient,authenticate,preflight,json} from '../_shared/http.ts';
import {budgetedTornFetch} from '../_shared/torn-budget.ts';
import {resolveRefreshKey} from '../_shared/live-refresh.ts';
import {LoginError} from '../_shared/torn-login.ts';
import {tornGet} from '../_shared/torn.ts';
import {submissionRequest,verifiedCommunityProfile} from '../_shared/community-levelling.ts';
Deno.serve(async(req)=>{
 const early=preflight(req);if(early)return early;
 try{
  const admin=adminClient(),user=await authenticate(req,admin);
  if(!user)return json({error:'Sign in to submit a player.'},401);
  const body=await submissionRequest(req);
  const profile=await admin.from('profiles').select('tracking_paused').eq('id',user.id).single();
  if(profile.error)throw profile.error;
  if(profile.data.tracking_paused)return json({error:'Resume tracking in Settings to verify a submission.'},409);
  const fetcher=budgetedTornFetch(admin,user.id);
  const key=await resolveRefreshKey(admin,user.id,body.apiKey,Deno.env.get('TORN_KEY_ENCRYPTION_KEY'),fetcher);
  // Always fetch a new official profile; no client timestamp, profile or cache authorizes entry.
  const payload=await tornGet(`/user/${body.player_id}/profile`,key,fetcher);
  const target=verifiedCommunityProfile(body.player_id,payload);
  const saved=await admin.rpc('record_community_levelling_target',{owner_id:user.id,player_id:target.id,player_name:target.name,player_level:target.level,last_action_epoch:target.lastAction});
  if(saved.error)throw saved.error;
  return json({target:saved.data});
 }catch(error){
  if(error instanceof LoginError)return json({error:error.message},error.status);
  return json({error:'Unable to verify this submission. Check your Torn key permissions and retry.'},503);
 }
});
