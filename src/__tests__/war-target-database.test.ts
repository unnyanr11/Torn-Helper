import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,it,expect} from 'vitest';
const db=new PGlite(),one='00000000-0000-4000-8000-000000000001',two='00000000-0000-4000-8000-000000000002';
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema private;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;create table public.profiles(id uuid primary key);create table public.linked_torn_accounts(user_id uuid,torn_id bigint,torn_name text,revoked_at timestamptz);grant select on public.linked_torn_accounts to authenticated;alter table public.linked_torn_accounts enable row level security;create policy own_link on public.linked_torn_accounts for select to authenticated using(user_id=auth.uid());create publication supabase_realtime;insert into public.profiles values('${one}'),('${two}');insert into public.linked_torn_accounts values('${one}',1,'Leader',null),('${two}',2,'Member',null);`);
 await db.exec(readFileSync('supabase/migrations/20261112183654_war_target_assignments.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261112185335_war_coordination.sql','utf8'));
 await db.exec(`grant select on public.linked_torn_accounts to service_role;insert into public.war_target_lists(user_id,faction_id,war_key,enemy_faction_id,updated_by,verified_until) values('${one}',1,'ranked:7:2',2,1,now()+interval '2 minutes'),('${two}',1,'ranked:7:2',2,1,now()+interval '2 minutes')`);
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
