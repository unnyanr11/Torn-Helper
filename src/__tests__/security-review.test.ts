import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {budgetedTornFetch} from '../../supabase/functions/_shared/torn-budget';
import {alertHour,isolatedAlertRules} from '../../supabase/functions/_shared/alert-isolation';
const db=new PGlite();
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',c='00000000-0000-4000-8000-000000000003';
async function user(id:string,sql:string,args:any[]=[]){await db.exec(`select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`);try{return await db.query<any>(sql,args);}finally{await db.exec('reset role');}}
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema private;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,private to authenticated,service_role;create table profiles(id uuid primary key,timezone text default 'UTC');create table wars(id uuid primary key,user_id uuid);create table alert_rules(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles(id),name text,condition_type text,threshold jsonb,enabled boolean default true,quiet_hours_start text,quiet_hours_end text,due_soon_days integer,created_at timestamptz default now());alter table alert_rules enable row level security;create policy own_alerts on alert_rules for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());`);
 const login=readFileSync('supabase/migrations/20261019153325_torn_key_authentication.sql','utf8');await db.exec(login.slice(0,login.indexOf('create function private.complete_torn_login')));
 const data=readFileSync('supabase/migrations/20261019161634_api_data_browser.sql','utf8');await db.exec(data.slice(data.indexOf('create table private.torn_data_budgets'),data.indexOf('create function private.store_torn_data')));
 for(const f of ['0016_alliances.sql','0021_graffiti.sql','0046_ai_war_analyzer.sql'])await db.exec(readFileSync('supabase/migrations/'+f,'utf8'));
 await db.exec('grant all on all tables in schema public to authenticated,service_role;');
 await db.exec(readFileSync('supabase/migrations/20261111201917_security_review_fixes.sql','utf8'));
 await db.query('insert into profiles(id) values($1),($2),($3)',[a,b,c]);
});
afterAll(()=>db.close());
describe('service-only atomic budgets',()=>{
 it('does not let one throttled IP exhaust the shared login allowance',async()=>{
  for(let i=0;i<201;i++)await db.query('select private.consume_torn_login_budget($1,$2)',['a'.repeat(64),i.toString(16).padStart(64,'0')]);
  expect((await db.query<any>('select private.consume_torn_login_budget($1,$2) allowed',['b'.repeat(64),'c'.repeat(64)])).rows[0].allowed).toBe(true);
  expect((await db.query<any>("select attempts from private.torn_login_limits where scope='global'")).rows[0].attempts).toBe(31);
 });
 it('keeps rejected user requests out of the global Torn counter',async()=>{
  for(let i=0;i<100;i++)await db.query('select private.consume_torn_data_budget($1,1)',[a]);
  expect((await db.query<any>("select attempts from private.torn_data_budgets where scope='global'")).rows[0].attempts).toBe(60);
  expect((await db.query<any>('select private.consume_torn_data_budget($1,1) allowed',[b])).rows[0].allowed).toBe(true);
 });
 it('caps parallel upstream calls and binds cleanup tokens to their owner',async()=>{
  const tokens:string[]=[];for(let i=0;i<6;i++)tokens.push((await db.query<any>('select private.torn_request_slot($1) token',[a])).rows[0].token);
  expect((await db.query<any>('select private.torn_request_slot($1) token',[a])).rows[0].token).toBeNull();
  await db.query('select private.torn_request_slot($1,$2)',[b,tokens[0]]);
  expect((await db.query<any>('select private.torn_request_slot($1) token',[a])).rows[0].token).toBeNull();
  await db.query('select private.torn_request_slot($1,$2)',[a,tokens[0]]);
  expect((await db.query<any>('select private.torn_request_slot($1) token',[a])).rows[0].token).toBeTypeOf('string');
  await expect(user(a,'select public.torn_request_slot($1)',[a])).rejects.toThrow('permission denied');
 });
 it('reserves AI quota atomically and disallows history editing or reservation by clients',async()=>{
  const results=await Promise.all(Array.from({length:6},()=>db.query<any>("select private.reserve_ai_analysis($1,'openai','test-model') id",[a])));
  expect(results.filter(r=>r.rows[0].id)).toHaveLength(3);
  for(const sql of ['delete from ai_analysis_requests','update ai_analysis_requests set created_at=now()','insert into ai_analysis_requests(user_id) values($1)'])await expect(user(a,sql,sql.includes('$1')?[a]:[])).rejects.toThrow('permission denied');
  await expect(user(a,"select public.reserve_ai_analysis($1,'openai','test-model')",[a])).rejects.toThrow('permission denied');
  // Even privileged deletion of displayed history cannot restore the separate budget.
  await db.exec('delete from ai_analysis_requests');
  expect((await db.query<any>("select private.reserve_ai_analysis($1,'openai','test-model') id",[a])).rows[0].id).toBeNull();
 });
});
describe('alliance authorization',()=>{
 let first:string,second:string;
 it('creates a group and initial leader atomically without recursive policies',async()=>{
  first=(await user(a,"select public.create_alliance('First','A') id")).rows[0].id;
  second=(await user(b,"select public.create_alliance('Second','B') id")).rows[0].id;
  expect((await user(a,'select * from alliances')).rows.map(r=>r.id)).toEqual([first]);
  expect((await user(a,'select * from alliance_members')).rows).toHaveLength(1);
  expect((await user(c,'select * from alliance_members')).rows).toHaveLength(0);
 });
 it('blocks cross-alliance reads, membership changes and forged announcements',async()=>{
  await expect(user(a,"insert into alliance_members(alliance_id,user_id,role) values($1,$2,'leader')",[second,a])).rejects.toThrow('row-level security');
  expect((await user(a,"update alliance_members set role='member' where alliance_id=$1 returning id",[second])).rows).toEqual([]);
  await expect(user(a,"insert into alliance_announcements(alliance_id,author_user_id,title,body) values($1,$2,'Bad','Bad')",[second,a])).rejects.toThrow('row-level security');
  await user(b,"insert into alliance_announcements(alliance_id,author_user_id,title,body) values($1,$2,'Private','Private')",[second,b]);
  expect((await user(a,'select * from alliance_announcements')).rows).toEqual([]);
 });
 it('does not allow an officer to promote themselves or insert a leader',async()=>{
  await user(a,"insert into alliance_members(alliance_id,user_id,role) values($1,$2,'officer')",[first,c]);
  expect((await user(c,"update alliance_members set role='leader' where user_id=$1 returning id",[c])).rows).toEqual([]);
  await expect(user(c,"insert into alliance_members(alliance_id,user_id,role) values($1,$2,'leader')",[first,b])).rejects.toThrow('row-level security');
 });
 it('scopes graffiti and prevents invitation identity reassignment',async()=>{
  await user(b,"insert into graffiti_posts(alliance_id,author_user_id,body) values($1,$2,'Private')",[second,b]);
  expect((await user(a,'select * from graffiti_posts')).rows).toEqual([]);
  const invite=(await user(b,'insert into alliance_invitations(alliance_id,inviter_user_id,invitee_user_id) values($1,$2,$3) returning id',[second,b,c])).rows[0].id;
  await expect(user(c,'update alliance_invitations set alliance_id=$1 where id=$2',[first,invite])).rejects.toThrow('permission denied');
 });
});
describe('alert safety and tenant isolation',()=>{
 it('rejects invalid profile zones and extreme rule windows at the database',async()=>{
  await expect(user(a,"update profiles set timezone='Invalid/Zone' where id=$1",[a])).rejects.toThrow('valid IANA timezone');
  await expect(user(a,"insert into alert_rules(user_id,name,due_soon_days) values($1,'Bad',2147483647)",[a])).rejects.toThrow('0 to 365');
 });
 it('caps enabled rules and protects the fair scheduling timestamp',async()=>{
  for(let i=0;i<25;i++)await user(a,"insert into alert_rules(user_id,name) values($1,'Alert')",[a]);
  await expect(user(a,"insert into alert_rules(user_id,name) values($1,'Overflow')",[a])).rejects.toThrow('25 enabled');
  await expect(user(a,'update alert_rules set last_evaluated_at=null')).rejects.toThrow('permission denied');
 });
 it('handles legacy invalid zones and continues after an individual rule fails',async()=>{
  expect(alertHour('Invalid/Zone',new Date('2026-01-01T09:00:00Z'))).toBe(9);
  const evaluated:number[]=[],marked:number[]=[];
  const failed=await isolatedAlertRules([1,2],async r=>{evaluated.push(r);if(r===1)throw new Error('bad rule');},async r=>{marked.push(r);});
  expect(failed).toBe(1);expect(evaluated).toEqual([1,2]);expect(marked).toEqual([1,2]);
 });
});
describe('upstream adapter',()=>{
 it('never fetches on denied quota and always releases a granted lease after failure',async()=>{
  const fetcher=vi.fn().mockRejectedValue(new Error('network failure'));
  const denied={rpc:vi.fn().mockResolvedValue({data:false,error:null})};
  await expect(budgetedTornFetch(denied,a,fetcher)('https://api.torn.com/v2/user')).rejects.toThrow('limit reached');expect(fetcher).not.toHaveBeenCalled();
  const admin={rpc:vi.fn().mockResolvedValueOnce({data:true,error:null}).mockResolvedValueOnce({data:'lease',error:null}).mockResolvedValue({data:null,error:null})};
  await expect(budgetedTornFetch(admin,a,fetcher)('https://api.torn.com/v2/user')).rejects.toThrow('network failure');
  expect(admin.rpc).toHaveBeenLastCalledWith('torn_request_slot',{owner_id:a,release_token:'lease'});
 });
 it('rejects arbitrary origins and preserves bounded successful JSON responses',async()=>{
  const admin={rpc:vi.fn().mockResolvedValueOnce({data:true,error:null}).mockResolvedValueOnce({data:'lease',error:null}).mockResolvedValue({data:null,error:null})};
  const fetcher=vi.fn().mockResolvedValue(new Response('{"ok":true}'));
  await expect(budgetedTornFetch(admin,a,fetcher)('https://attacker.test')).rejects.toThrow('Unsupported');expect(admin.rpc).not.toHaveBeenCalled();
  expect(await (await budgetedTornFetch(admin,a,fetcher)('https://api.torn.com/v2/user')).json()).toEqual({ok:true});
  expect(fetcher.mock.calls[0][1].redirect).toBe('error');
 });
});
