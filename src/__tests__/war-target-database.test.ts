import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,it,expect} from 'vitest';
const db=new PGlite(),one='00000000-0000-4000-8000-000000000001',two='00000000-0000-4000-8000-000000000002';
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;create table public.profiles(id uuid primary key);create table public.linked_torn_accounts(user_id uuid,torn_id bigint,revoked_at timestamptz);grant select on public.linked_torn_accounts to authenticated;alter table public.linked_torn_accounts enable row level security;create policy own_link on public.linked_torn_accounts for select to authenticated using(user_id=auth.uid());create publication supabase_realtime;insert into public.profiles values('${one}'),('${two}');insert into public.linked_torn_accounts values('${one}',1,null),('${two}',2,null);`);
 await db.exec(readFileSync('supabase/migrations/20261112183654_war_target_assignments.sql','utf8'));
 await db.exec(`insert into public.war_target_lists(user_id,faction_id,war_key,enemy_faction_id,updated_by,verified_until) values('${one}',1,'ranked:7:2',2,1,now()+interval '2 minutes'),('${two}',1,'ranked:7:2',2,1,now()+interval '2 minutes')`);
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
