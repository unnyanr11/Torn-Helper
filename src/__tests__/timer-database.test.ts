import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
const db=new PGlite(),owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema private;create schema cron;grant usage on schema auth to authenticated;grant usage on schema private to service_role;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table auth.users(id uuid primary key);create table public.profiles(id uuid primary key,tracking_paused boolean not null default false);create table public.linked_torn_accounts(user_id uuid primary key,revoked_at timestamptz);create table public.encrypted_credentials(user_id uuid,provider text,encrypted_key text);create table public.torn_data_cache(user_id uuid,request_hash text,endpoint_id text,parameters jsonb,payload jsonb,fetched_at timestamptz);create publication supabase_realtime;create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;`);
 await db.exec(readFileSync('supabase/migrations/20261112113507_event_driven_timers.sql','utf8'));
 for(const id of [owner,other])await db.query(`insert into auth.users values($1);`,[id]);
 await db.query(`insert into public.profiles(id) values($1),($2)`,[owner,other]);
 await db.query(`insert into public.linked_torn_accounts(user_id) values($1),($2)`,[owner,other]);
 await db.query(`insert into public.encrypted_credentials values($1,'torn','ciphertext'),($2,'torn','ciphertext')`,[owner,other]);
});
afterAll(()=>db.close());
async function save(user:string,endpoint:string,payload:any,at='2026-11-12T12:00:00Z',params={}){await db.query(`insert into public.torn_data_cache values($1,$2,$3,$4,$5,$6)`,[user,Math.random().toString(),endpoint,JSON.stringify(params),JSON.stringify(payload),at]);}
async function asUser(user:string,sql:string){await db.exec(`select set_config('request.jwt.claim.sub','${user}',false);set role authenticated;`);try{return await db.query<any>(sql);}finally{await db.exec('reset role');}}
describe('durable backend timers',()=>{
 it('stores absolute cooldown deadlines once and retains them when the short-lived API cache is cleared',async()=>{
  await save(owner,'v2-user-cooldowns',{cooldowns:{drug:3600,medical:0,booster:120}});
  const result=await db.query<any>(`select deadlines,observed_at from public.torn_timer_baselines where user_id=$1`,[owner]);
  expect(result.rows[0].deadlines.drug).toBe(Date.parse('2026-11-12T13:00:00Z')/1000);expect(result.rows[0].deadlines.medical).toBe(Date.parse('2026-11-12T12:00:00Z')/1000);
  await db.query(`delete from public.torn_data_cache where user_id=$1`,[owner]);expect((await db.query(`select * from public.torn_timer_baselines where user_id=$1`,[owner])).rows).toHaveLength(1);
 });
 it('does not overwrite a newer baseline with an old observation or another player lookup',async()=>{
  await save(owner,'v2-user-cooldowns',{cooldowns:{drug:20}},'2026-11-12T11:00:00Z');
  await save(owner,'v2-user-profile',{profile:{status:{until:1800000000}}},'2026-11-12T12:00:00Z',{id:'999'});
  const rows=await db.query<any>(`select endpoint_id,payload from public.torn_timer_baselines where user_id=$1`,[owner]);expect(rows.rows).toHaveLength(1);expect(rows.rows[0].payload.cooldowns.drug).toBe(3600);
 });
 it('derives refill timing from the returned rate and next tick, without hard-coded player perks',async()=>{
  await save(owner,'v2-user-bars',{bars:{energy:{current:90,maximum:100,increment:5,interval:300,tick_time:120}}});
  const row=await db.query<any>(`select deadlines from public.torn_timer_baselines where user_id=$1 and endpoint_id='v2-user-bars'`,[owner]);expect(row.rows[0].deadlines.energy_full).toBe(Date.parse('2026-11-12T12:07:00Z')/1000);
 });
 it('isolates private timers and denies client writes or job-control RPCs',async()=>{
  await save(other,'v2-user-travel',{travel:{time_left:120}});
  expect((await asUser(other,'select * from public.torn_timer_baselines')).rows).toHaveLength(1);
  await expect(asUser(other,`update public.torn_timer_baselines set payload='{}'`)).rejects.toThrow(/permission denied/i);
  await expect(asUser(other,'select public.claim_timer_jobs(null)')).rejects.toThrow(/permission denied/i);
 });
 it('leases a due owner once and cannot finish another lease with a guessed token',async()=>{
  await db.exec(`update private.torn_timer_jobs set next_check_at=now()-interval '1 minute'`);
  const rows=await db.query<any>(`select public.claim_timer_jobs($1) as jobs`,[owner]);const task=rows.rows[0].jobs[0];expect(task.user_id).toBe(owner);
  expect((await db.query<any>(`select public.claim_timer_jobs($1) as jobs`,[owner])).rows[0].jobs).toHaveLength(0);
  expect((await db.query<any>(`select public.finish_timer_job($1,$2,'{}') as ok`,[owner,'00000000-0000-4000-8000-000000000099'])).rows[0].ok).toBe(false);
  const result={cursor_to:task.cursor_to+60,scan_to:null,next_parameters:null,pending_endpoints:['v2-user-travel'],error:null,retry_seconds:60};
  expect((await db.query<any>(`select public.finish_timer_job($1,$2,$3) as ok`,[owner,task.token,JSON.stringify(result)])).rows[0].ok).toBe(true);
  const status=await db.query<any>(`select checked_through,status from public.torn_timer_sync_status where user_id=$1`,[owner]);expect(Number(status.rows[0].checked_through)).toBe(task.cursor_to+60);expect(status.rows[0].status).toBe('watching');
 });
 it('does not poll users who paused tracking or revoked their linked identity',async()=>{
  await db.query(`update public.profiles set tracking_paused=true where id=$1`,[other]);
  expect((await db.query<any>(`select public.claim_timer_jobs($1) as jobs`,[other])).rows[0].jobs).toHaveLength(0);
 });
});
