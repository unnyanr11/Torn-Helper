import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,it,expect,describe,beforeEach} from 'vitest';
const db=new PGlite(),one='00000000-0000-4000-8000-000000000001',two='00000000-0000-4000-8000-000000000002';
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema private;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;create table public.profiles(id uuid primary key);create table public.linked_torn_accounts(user_id uuid,torn_id bigint,torn_name text,revoked_at timestamptz);grant select on public.linked_torn_accounts to authenticated;alter table public.linked_torn_accounts enable row level security;create policy own_link on public.linked_torn_accounts for select to authenticated using(user_id=auth.uid());create publication supabase_realtime;insert into public.profiles values('${one}'),('${two}');insert into public.linked_torn_accounts values('${one}',1,'Leader',null),('${two}',2,'Member',null);`);
 await db.exec(`create table public.notifications(id uuid default gen_random_uuid(),user_id uuid,title text,body text,created_at timestamptz default now());grant all on public.notifications to service_role;`);
 await db.exec(readFileSync('supabase/migrations/20261112183654_war_target_assignments.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261112185335_war_coordination.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261112192716_war_rest_resume.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261112194559_war_fair_claims.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261112201322_three_active_war_claims.sql','utf8'));
 await db.exec(`insert into public.war_claim_policies values(1,'ranked:7:2',100);grant select on public.linked_torn_accounts to service_role;insert into public.war_target_lists(user_id,faction_id,war_key,enemy_faction_id,updated_by,verified_until) values('${one}',1,'ranked:7:2',2,1,now()+interval '2 minutes'),('${two}',1,'ranked:7:2',2,1,now()+interval '2 minutes')`);
});afterAll(()=>db.close());
it('owners can read only their list, and browser roles cannot forge assignments or leadership',async()=>{
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${one}',false)`);
 const rows=await db.query<any>('select user_id from public.war_target_lists');expect(rows.rows.map(r=>r.user_id)).toEqual([one]);
 await expect(db.query(`update public.war_target_lists set updated_by=1 where user_id='${two}'`)).rejects.toThrow(/permission denied/);
 await expect(db.query(`insert into public.war_target_lists(user_id,faction_id,war_key,enemy_faction_id,updated_by,verified_until) values('${one}',1,'fake',2,1,now())`)).rejects.toThrow(/permission denied/);
 await db.exec('reset role;set role anon');await expect(db.query('select * from public.war_target_lists')).rejects.toThrow(/permission denied/);await db.exec('reset role');
});
it('revoked accounts cannot read saved assignments',async()=>{
 await db.exec(`update public.linked_torn_accounts set revoked_at=now() where user_id='${one}';set role authenticated;select set_config('request.jwt.claim.sub','${one}',false)`);
 expect((await db.query('select * from public.war_target_lists')).rows).toHaveLength(0);await db.exec('reset role');
});

it('claims are exclusive, count attacks exactly once and release automatically at the chosen goal',async()=>{
 await db.exec(`update public.linked_torn_accounts set revoked_at=null;update public.war_target_lists set target_ids=array[50::bigint],war_start=1;select public.verify_war_membership('${one}',1,1);select public.verify_war_membership('${two}',1,2);`);
 await db.query('select public.take_war_target($1,50,2)',[one]);
 await expect(db.query('select public.take_war_target($1,50,1)',[two])).rejects.toThrow('already claimed');
 await db.exec(`update public.war_target_claims set claimed_at=now()-interval '2 seconds'`);
 const stamp=(await db.query<any>('select floor(extract(epoch from now())) as t')).rows[0].t;
 const attack={id:'101',attacker:1,defender:50,started:Number(stamp),ended:Number(stamp)};
 await db.query('select public.record_war_claim_attacks($1,$2)',[one,JSON.stringify([attack])]);
 expect((await db.query<any>('select attacks_done from public.war_target_claims')).rows[0].attacks_done).toBe(1);
 await db.query('select public.record_war_claim_attacks($1,$2)',[one,JSON.stringify([attack])]);
 expect((await db.query<any>('select attacks_done from public.war_target_claims')).rows[0].attacks_done).toBe(1);
 await db.query('select public.record_war_claim_attacks($1,$2)',[one,JSON.stringify([{...attack,id:'102'}])]);
 expect((await db.query('select * from public.war_target_claims')).rows).toHaveLength(0);
 expect((await db.query<any>("select details from public.war_events where kind='claim_completed'")).rows[0].details.goal).toBe(2);
 await db.query('select public.take_war_target($1,50,1)',[two]);
 await expect(db.query('select public.take_war_target($1,50,101)',[one])).rejects.toThrow('between 1 and 100');
});
it('expired claims can be taken, off-target attacks do not count, and stale membership cannot read faction claims',async()=>{
 await db.exec("update public.war_target_claims set expires_at=now()-interval '1 second'");
 await db.query('select public.take_war_target($1,50,2)',[one]);
 const stamp=(await db.query<any>('select floor(extract(epoch from now())) as t')).rows[0].t;
 await db.query('select public.record_war_claim_attacks($1,$2)',[one,JSON.stringify([{id:'103',attacker:1,defender:999,started:Number(stamp),ended:Number(stamp)}])]);
 expect((await db.query<any>('select attacks_done from public.war_target_claims')).rows[0].attacks_done).toBe(0);
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${two}',false)`);
 expect((await db.query('select * from public.war_target_claims')).rows).toHaveLength(1);
 await expect(db.query('select public.take_war_target($1,50,1)',[two])).rejects.toThrow('permission denied');await db.exec('reset role');
 await db.exec(`update private.war_memberships set faction_id=2 where user_id='${two}';set role authenticated;select set_config('request.jwt.claim.sub','${two}',false)`);
 expect((await db.query('select * from public.war_target_claims')).rows).toHaveLength(0);await db.exec('reset role');
});
it('assignment audit is atomic and browser roles cannot forge preferences, reports or activity',async()=>{
 await db.exec(`update public.war_target_lists set priorities='{"50":1}' where user_id='${two}'`);
 expect((await db.query<any>("select details from public.war_events where kind='assignment' order by id desc limit 1")).rows[0].details.priorities).toEqual({'50':1});
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${two}',false)`);
 for(const table of ['war_alert_preferences','war_reports','war_events','war_target_claims'])await expect(db.query(`delete from public.${table}`)).rejects.toThrow('permission denied');
 await db.exec('reset role');
});

async function resetRestClaims(){
 await db.exec(`reset role;delete from public.war_target_claims;delete from public.war_rest_claims;delete from public.war_wait_queue;delete from public.war_target_rules;delete from public.war_transfer_requests;update public.war_target_lists set target_ids=array[50::bigint,51::bigint],targets='[{"id":50,"name":"Target 50","state":"Okay"},{"id":51,"name":"Target 51","state":"Okay"}]',active=true,resting=false,verified_until=now()+interval '2 minutes';select public.verify_war_membership('${one}',1,1);select public.verify_war_membership('${two}',1,2);`);
}
it('rest releases unfinished claims, preserves remaining attacks and never steals another member’s reservation on return',async()=>{
 await resetRestClaims();
 const first=(await db.query<any>('select public.take_war_target($1,50,3) as claim',[one])).rows[0].claim;
 await db.exec(`update public.war_target_claims set attacks_done=1 where user_id='${one}'`);
 expect((await db.query<any>('select public.rest_war_targets($1) as result',[one])).rows[0].result.released).toBe(1);
 expect((await db.query<any>('select resting from public.war_target_lists where user_id=$1',[one])).rows[0].resting).toBe(true);
 const paused=(await db.query<any>('select * from public.war_rest_claims where user_id=$1',[one])).rows[0];expect(paused.attacks_goal-paused.attacks_done).toBe(2);
 await expect(db.query('select public.take_war_target($1,51,2)',[one])).rejects.toThrow('Refresh your assigned targets');
 await db.query('select public.take_war_target($1,50,1)',[two]);
 const blocked=(await db.query<any>('select public.resume_war_targets($1) as result',[one])).rows[0].result;
 expect(blocked.resumed).toEqual([]);expect(blocked.blocked[0].target_id).toBe(50);
 expect((await db.query<any>('select user_id from public.war_target_claims')).rows[0].user_id).toBe(two);
 await db.exec("update public.war_target_claims set expires_at=now()-interval '1 second'");
 const back=(await db.query<any>('select public.resume_war_targets($1) as result',[one])).rows[0].result;
 expect(back.resumed[0].remaining).toBe(2);
 const restored=(await db.query<any>('select * from public.war_target_claims')).rows[0];expect(restored.attacks_goal).toBe(3);expect(restored.attacks_done).toBe(1);expect(restored.claim_id).not.toBe(first.claim_id);
 expect((await db.query('select * from public.war_rest_claims')).rows).toHaveLength(0);
});
it('reconciles late original-claim attacks exactly once and ignores attacks made after resting',async()=>{
 await resetRestClaims();await db.query('select public.take_war_target($1,50,2)',[one]);
 await db.exec("update public.war_target_claims set claimed_at=now()-interval '20 seconds'");
 await db.query('select public.rest_war_targets($1)',[one]);
 const r=(await db.query<any>('select extract(epoch from rested_at) as ended from public.war_rest_claims')).rows[0];
 const before=Math.floor(Number(r.ended))-1,after=Math.ceil(Number(r.ended))+1;
 const hit={id:'rest-attack',attacker:1,defender:50,started:before-1,ended:before};
 const batch=[{...hit,id:'801'},{...hit,id:'802',started:after,ended:after}];
 await db.query('select public.record_rest_attacks($1,$2)',[one,JSON.stringify(batch)]);await db.query('select public.record_rest_attacks($1,$2)',[one,JSON.stringify(batch)]);
 expect((await db.query<any>('select attacks_done from public.war_rest_claims')).rows[0].attacks_done).toBe(1);
 await db.query('select public.record_rest_attacks($1,$2)',[one,JSON.stringify([{...hit,id:'803'}])]);
 const result=(await db.query<any>('select public.resume_war_targets($1) as result',[one])).rows[0].result;
 expect(result.resumed).toEqual([]);expect(result.discarded[0].reason).toContain('already completed');expect((await db.query('select * from public.war_target_claims')).rows).toHaveLength(0);
});
it('does not resume a target removed by the leader and repeated rest does not erase unfinished goals',async()=>{
 await resetRestClaims();await db.query('select public.take_war_target($1,50,4)',[one]);await db.query('select public.rest_war_targets($1)',[one]);await db.query('select public.rest_war_targets($1)',[one]);
 expect((await db.query<any>('select attacks_goal from public.war_rest_claims')).rows[0].attacks_goal).toBe(4);
 await db.exec(`update public.war_target_lists set target_ids=array[51::bigint] where user_id='${one}'`);
 const result=(await db.query<any>('select public.resume_war_targets($1) as result',[one])).rows[0].result;expect(result.resumed).toEqual([]);expect(result.discarded[0].reason).toContain('no longer assigned');
});
it('rested goals remain owner-only and browser roles cannot invoke rest or resume for anyone',async()=>{
 await resetRestClaims();await db.query('select public.take_war_target($1,50,4)',[one]);await db.query('select public.rest_war_targets($1)',[one]);
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${two}',false)`);
 expect((await db.query('select * from public.war_rest_claims')).rows).toHaveLength(0);
 for(const rpc of ['rest_war_targets','resume_war_targets'])await expect(db.query(`select public.${rpc}($1)`,[one])).rejects.toThrow('permission denied');
 await expect(db.query('delete from public.war_rest_claims')).rejects.toThrow('permission denied');await db.exec('reset role');
});

const three='00000000-0000-4000-8000-000000000003',outside='00000000-0000-4000-8000-000000000004';
const enemyTargets=[{id:50,name:'Target 50',state:'Okay',level:1,hospital_until:null},{id:51,name:'Target 51',state:'Okay',level:1,hospital_until:null},{id:52,name:'Target 52',state:'Okay',level:1,hospital_until:null},{id:53,name:'Target 53',state:'Okay',level:1,hospital_until:null}];
async function commandProof(user:string,id:number,leaderId=1,faction=1,war='ranked:7:2'){
 await db.query('select public.verify_war_command($1,$2,$3,$4,$5,$6,2,$7,1)',[user,faction,war,id,leaderId,faction===1?[1,2,3]:[4],JSON.stringify(enemyTargets)]);
}
async function gov(user:string,command:string,body:any={}){return (await db.query<any>('select public.war_governance($1,$2,$3) as data',[user,command,JSON.stringify(body)])).rows[0].data;}
describe('first-come queues, mutual agreements and delegated leadership',()=>{
 beforeEach(async()=>{
  await resetRestClaims();await db.exec(`delete from public.war_handlers;delete from public.war_claim_policies;delete from private.war_command_proofs;insert into public.profiles values('${three}'),('${outside}') on conflict do nothing;insert into public.linked_torn_accounts values('${three}',3,'Third',null),('${outside}',4,'Outside',null) on conflict do nothing;`);
  for(const [user,id] of [[three,3],[outside,4]] as const){await db.query(`insert into public.war_target_lists(user_id,faction_id,war_key,enemy_faction_id,target_ids,targets,active,updated_by,verified_until) values($1,$2,'ranked:7:2',2,array[50::bigint,51::bigint,52::bigint,53::bigint],$3,true,$4,now()+interval '2 minutes') on conflict(user_id) do update set faction_id=excluded.faction_id,active=true,resting=false,target_ids=excluded.target_ids,targets=excluded.targets,verified_until=excluded.verified_until`,[user,id===4?2:1,JSON.stringify(enemyTargets),id]);}
  await db.query(`update public.war_target_lists set target_ids=array[50::bigint,51::bigint,52::bigint,53::bigint],targets=$1 where user_id in($2,$3)`,[JSON.stringify(enemyTargets),one,two]);
  for(const [user,id] of [[one,1],[two,2],[three,3]] as const)await commandProof(user,id);
  await commandProof(outside,4,4,2);
 });
 it('allows three active claims, rejects a fourth and keeps the per-claim attack cap separate',async()=>{
  await expect(db.query('select public.take_war_target($1,50,4)',[one])).rejects.toThrow('between 1 and 3');
  for(const target of [50,51,52])await db.query('select public.take_war_target($1,$2,1)',[one,target]);
  await expect(db.query('select public.take_war_target($1,53,1)',[one])).rejects.toThrow('three active');
  await expect(db.query('select public.take_war_target($1,50,3)',[one])).rejects.toThrow('already hold');
  await db.exec('update public.war_target_claims set expires_at=now()-interval \'1 second\' where target_id=50');
  await db.query('select public.take_war_target($1,53,1)',[one]);expect((await db.query('select * from public.war_target_claims where expires_at>now()')).rows).toHaveLength(3);
 });
 it('preserves queue order, rejects jumping ahead, and expires an unanswered turn',async()=>{
  await db.query('select public.take_war_target($1,50,1)',[one]);await gov(two,'queue',{target_id:50});await gov(three,'queue',{target_id:50});
  const id=(await db.query<any>('select id from public.war_wait_queue where user_id=$1',[two])).rows[0].id;await gov(two,'queue',{target_id:50});expect((await db.query<any>('select id from public.war_wait_queue where user_id=$1',[two])).rows[0].id).toBe(id);
  await db.exec('delete from public.war_target_claims');await gov(three,'snapshot');
  expect((await db.query<any>('select public.take_war_target($1,50,1) as data',[three])).rows[0].data.error).toContain('queued member');
  await db.exec(`update public.war_wait_queue set offer_until=now()-interval '1 second' where user_id='${two}'`);await gov(three,'snapshot');
  await db.query('select public.take_war_target($1,50,1)',[three]);expect((await db.query<any>('select user_id from public.war_target_claims')).rows[0].user_id).toBe(three);
  expect((await db.query<any>("select body from public.notifications where user_id=$1 and body like '%expired%'",[two])).rows.length).toBeGreaterThan(0);
 });
 it('returning from rest joins behind existing waiters and retains the original remaining goal',async()=>{
  await db.query('select public.take_war_target($1,50,3)',[one]);await db.exec(`update public.war_target_claims set attacks_done=1`);await db.query('select public.rest_war_targets($1)',[one]);
  await gov(two,'queue',{target_id:50});await gov(three,'queue',{target_id:50});
  const back=(await db.query<any>('select public.resume_war_targets($1) as data',[one])).rows[0].data;expect(back.resumed).toEqual([]);expect(back.blocked[0].reason).toContain('Queued');
  expect((await db.query<any>('select user_id from public.war_wait_queue order by id')).rows.map(r=>r.user_id)).toEqual([two,three,one]);
  await gov(two,'leave_queue',{target_id:50});await gov(three,'leave_queue',{target_id:50});
  const restored=(await db.query<any>('select public.take_war_target($1,50,1) as data',[one])).rows[0].data;expect(restored.attacks_goal).toBe(3);expect(restored.attacks_done).toBe(1);
 });
 it('requires acceptance from the current holder before a requested transfer changes anything',async()=>{
  await db.query('select public.take_war_target($1,50,3)',[one]);await db.exec('update public.war_target_claims set attacks_done=1');
  const request=await gov(two,'propose',{target_id:50});expect((await db.query<any>('select user_id from public.war_target_claims')).rows[0].user_id).toBe(one);
  await expect(gov(two,'respond',{request_id:request.id,accept:true})).rejects.toThrow('Request expired');await expect(gov(three,'respond',{request_id:request.id,accept:true})).rejects.toThrow('Request expired');
  await gov(one,'respond',{request_id:request.id,accept:true});const claim=(await db.query<any>('select * from public.war_target_claims')).rows[0];expect(claim.user_id).toBe(two);expect(claim.attacks_goal).toBe(2);expect(claim.attacks_done).toBe(0);
  expect((await db.query("select * from public.war_events where kind='mutual_transfer'")).rows).toHaveLength(2);
 });
 it('swaps both live claims atomically and rejects stale or expired requests',async()=>{
  await db.query('select public.take_war_target($1,50,1)',[one]);await db.query('select public.take_war_target($1,51,1)',[two]);
  const request=await gov(two,'propose',{target_id:50,swap:true});await gov(one,'respond',{request_id:request.id,accept:true});
  const claims=(await db.query<any>('select target_id,user_id from public.war_target_claims order by target_id')).rows;expect(claims).toEqual([{target_id:50,user_id:two},{target_id:51,user_id:one}]);
  const again=await gov(one,'propose',{target_id:50,swap:true});await db.query("update public.war_transfer_requests set expires_at=now()-interval '1 second' where id=$1",[again.id]);await expect(gov(two,'respond',{request_id:again.id,accept:true})).rejects.toThrow('expired');
  expect((await db.query('select * from public.war_target_claims')).rows).toHaveLength(2);
 });
 it('checks the recipient cap again at transfer acceptance, then allows the third slot after a release',async()=>{
  await db.query('select public.take_war_target($1,50,1)',[one]);for(const id of [51,52])await db.query('select public.take_war_target($1,$2,1)',[two,id]);
  const request=await gov(two,'propose',{target_id:50});await db.query('select public.take_war_target($1,53,1)',[two]);
  await expect(gov(one,'respond',{request_id:request.id,accept:true})).rejects.toThrow('three active');
  expect((await db.query<any>('select user_id from public.war_target_claims where target_id=50')).rows[0].user_id).toBe(one);
  await db.exec(`delete from public.war_target_claims where user_id='${two}' and target_id=53`);await gov(one,'respond',{request_id:request.id,accept:true});
  expect((await db.query('select * from public.war_target_claims where user_id=$1 and expires_at>now()',[two])).rows).toHaveLength(3);
 });
 it('a member holding three claims selects exactly which one to swap',async()=>{
  await db.query('select public.take_war_target($1,50,1)',[one]);for(const id of [51,52,53])await db.query('select public.take_war_target($1,$2,1)',[two,id]);
  await expect(gov(two,'propose',{target_id:50,swap:true})).rejects.toThrow('Choose which');
  const request=await gov(two,'propose',{target_id:50,swap:true,swap_target_id:52});await gov(one,'respond',{request_id:request.id,accept:true});
  expect((await db.query<any>('select target_id from public.war_target_claims where user_id=$1 order by target_id',[two])).rows.map(r=>r.target_id)).toEqual([50,51,53]);
  expect((await db.query<any>('select target_id from public.war_target_claims where user_id=$1',[one])).rows[0].target_id).toBe(52);
 });
 it('rest and return restore at most three reservations and queue extra saved goals',async()=>{
  for(const id of [50,51,52])await db.query('select public.take_war_target($1,$2,1)',[one,id]);await db.query('select public.rest_war_targets($1)',[one]);
  await db.query(`insert into public.war_rest_claims(user_id,faction_id,war_key,target_id,target_name,claimant_torn_id,original_claim_id,original_claimed_at,attacks_goal,attacks_done) values($1,1,'ranked:7:2',53,'Target 53',1,gen_random_uuid(),now()-interval '2 minutes',1,0)`,[one]);
  const back=(await db.query<any>('select public.resume_war_targets($1) as data',[one])).rows[0].data;
  expect(back.resumed).toHaveLength(3);expect(back.blocked).toHaveLength(1);expect((await db.query('select * from public.war_target_claims where user_id=$1 and expires_at>now()',[one])).rows).toHaveLength(3);
  expect((await db.query('select * from public.war_wait_queue where user_id=$1',[one])).rows).toHaveLength(1);
 });
 it('only the actual current leader appoints handlers; appointments do not survive a leader or war change',async()=>{
  await gov(one,'handler',{member_id:2,enabled:true});expect((await gov(two,'snapshot')).can_manage).toBe(true);
  await expect(gov(two,'handler',{member_id:3,enabled:true})).rejects.toThrow('Only the current faction leader');await expect(gov(two,'policy',{max_attacks:10})).rejects.toThrow('Only the current faction leader');
  await commandProof(two,2,3);await expect(gov(two,'rule',{target_id:50,mode:'open',reason:'New leader invalidates role'})).rejects.toThrow('Only the current leader');
  await commandProof(two,2,1);expect((await gov(two,'snapshot')).can_manage).toBe(false);
  await commandProof(two,2,1,1,'ranked:8:2');await expect(gov(two,'rule',{target_id:50,mode:'open',reason:'Different war'})).rejects.toThrow('Only the current leader');
 });
 it('an appointed handler can assign targets but a live reservation requires an explicit audited override',async()=>{
  await gov(one,'handler',{member_id:2,enabled:true});await db.query('select public.take_war_target($1,50,1)',[one]);
  await expect(gov(two,'rule',{target_id:50,mode:'assigned',member_id:3,reason:'Tactical matchup'})).rejects.toThrow('explicit reasoned override');expect((await db.query<any>('select user_id from public.war_target_claims')).rows[0].user_id).toBe(one);
  await gov(two,'rule',{target_id:50,mode:'assigned',member_id:3,reason:'Tactical matchup',override:true});expect((await db.query('select * from public.war_target_claims')).rows).toHaveLength(0);
  await expect(db.query('select public.take_war_target($1,50,1)',[one])).rejects.toThrow('Leadership assigned');await db.query('select public.take_war_target($1,50,1)',[three]);
  expect((await db.query<any>("select body from public.notifications where user_id=$1 and body like '%Tactical matchup%'",[one])).rows.length).toBeGreaterThan(0);
  expect((await db.query("select * from public.war_events where kind='leadership_decision'")).rows).toHaveLength(1);
 });
 it('the leader can revoke a handler even after their app link is revoked',async()=>{
  await gov(one,'handler',{member_id:2,enabled:true});await db.exec(`update public.linked_torn_accounts set revoked_at=now() where user_id='${two}'`);
  await gov(one,'handler',{member_id:2,enabled:false});expect((await db.query('select * from public.war_handlers')).rows).toHaveLength(0);
  await db.exec(`update public.linked_torn_accounts set revoked_at=null where user_id='${two}'`);
 });
 it('a handler can edit assignments with a reason, while outsiders and forged browser writes cannot',async()=>{
  await gov(one,'handler',{member_id:2,enabled:true});const before=(await db.query<any>('select revision from public.war_target_lists where user_id=$1',[three])).rows[0].revision;
  const row={faction_id:1,war_key:'ranked:7:2',target_ids:[52],targets:[enemyTargets[2]],priorities:{}};
  await expect(db.query('select public.commit_war_assignments($1,$2,$3,$4,$5)',[three,two,JSON.stringify(row),before,''])).rejects.toThrow('recorded reason');
  await db.query('select public.commit_war_assignments($1,$2,$3,$4,$5)',[three,two,JSON.stringify(row),before,'Assign strongest matchup']);
  await expect(gov(outside,'handler',{member_id:2,enabled:true})).rejects.toThrow('current faction member');
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${two}',false)`);
  for(const table of ['war_handlers','war_wait_queue','war_target_rules','war_transfer_requests','war_claim_policies'])await expect(db.query(`delete from public.${table}`)).rejects.toThrow('permission denied');
  await expect(db.query("select public.war_governance($1,'handler','{}')",[one])).rejects.toThrow('permission denied');await db.exec('reset role');
 });
});
