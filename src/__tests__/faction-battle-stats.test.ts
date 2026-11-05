import {PGlite} from '@electric-sql/pglite';
import {runBattleJob} from '../../supabase/functions/_shared/faction-battle-worker';
import {readFileSync} from 'node:fs';
import {beforeAll,beforeEach,afterAll,describe,it,expect,vi} from 'vitest';
import {battleGrowth,compareBattleValues,formatBattleValue,filterSharedMembers,type SharedMember} from '../lib/faction-battle-stats';
const db=new PGlite(),leader='00000000-0000-4000-8000-000000000001',member='00000000-0000-4000-8000-000000000002',outsider='00000000-0000-4000-8000-000000000003';
async function asUser(user:string,sql:string){await db.exec(`select set_config('request.jwt.claim.sub','${user}',false);set role authenticated;`);try{return await db.query<any>(sql);}finally{await db.exec('reset role');}}
async function cache(user:string,endpoint:string,payload:any,age='0 seconds'){
 await db.query(`insert into public.torn_data_cache(user_id,request_hash,endpoint_id,parameters,payload,fetched_at) values($1,$2,$2,'{}',$3,now()-$4::interval) on conflict(user_id,request_hash) do update set payload=excluded.payload,fetched_at=excluded.fetched_at`,[user,endpoint,JSON.stringify(payload),age]);
}
const values={battlestats:{strength:{value:100},defense:{value:200},speed:{value:300},dexterity:{value:400},secret:'must-not-share'}};
async function verify(user:string,id:number,faction=10,leaderId=1){
 await cache(user,'v2-user-faction',{faction:{id:faction,name:'Our faction'}});
 await cache(user,'v2-faction-basic',{basic:{id:faction,name:'Our faction',leader_id:leaderId,co_leader_id:4}});
 await cache(user,'v2-faction-members',{members:[{id,name:'Viewer'},{id:2,name:'Consenting member'},{id:5,name:'Missing member'}]});
}
beforeAll(async()=>{
 await db.exec(`create role authenticated;create role anon;create role service_role bypassrls;create schema auth;create schema private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
 create table public.profiles(id uuid primary key,tracking_paused boolean not null default false);
 create table public.linked_torn_accounts(user_id uuid primary key references public.profiles(id),torn_id bigint unique,revoked_at timestamptz);
 create table public.encrypted_credentials(user_id uuid,provider text,encrypted_key text);
 create schema cron;create table cron.job(jobid bigint generated always as identity,jobname text,schedule text,command text);create function cron.schedule(name text,timing text,body text) returns bigint language sql as $$insert into cron.job(jobname,schedule,command) values(name,timing,body) returning jobid$$;
 create table public.torn_data_cache(user_id uuid,request_hash text,endpoint_id text,parameters jsonb,payload jsonb,fetched_at timestamptz,primary key(user_id,request_hash));
 insert into public.profiles(id) values('${leader}'),('${member}'),('${outsider}');
 insert into public.linked_torn_accounts(user_id,torn_id) values('${leader}',1),('${member}',2),('${outsider}',3);`);
 await db.exec(readFileSync('supabase/migrations/20261105093823_faction_battle_stat_sharing.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261105101523_faction_battle_log_estimates.sql','utf8'));
 await verify(leader,1);await verify(outsider,3,20,3);await cache(member,'v2-user-faction',{faction:{id:10}});await cache(member,'v2-user-battlestats',values);
});
afterAll(()=>db.close());
describe('leader access to opted-in faction battle stats',()=>{
 it('shows roster members but no stats until each member opts in',async()=>{
  const result=(await asUser(leader,'select public.faction_battle_dashboard(30) as data')).rows[0].data;
  expect(result.members).toHaveLength(3);expect(result.members.every((m:any)=>m.latest===null)).toBe(true);
 });
 it('publishes only the four official own stats and no private payload extras',async()=>{
  await asUser(member,'select public.set_faction_battle_sharing(true)');
  const result=(await asUser(leader,'select public.faction_battle_dashboard(30) as data')).rows[0].data;
  const stats=result.members.find((m:any)=>m.id===2).latest;expect(stats.strength).toBe('100');expect(stats.defense).toBe('200');expect(stats.speed).toBe('300');expect(stats.dexterity).toBe('400');expect(Object.keys(stats).sort()).toEqual(['baseline_at','defense','dexterity','observed_at','source','speed','strength']);
  expect(JSON.stringify(result)).not.toContain('must-not-share');
 });
 it('blocks non-leaders and a real leader from another faction',async()=>{
  await verify(member,2);await expect(asUser(member,'select public.faction_battle_dashboard(30)')).rejects.toThrow('Only your faction leader');
  const result=(await asUser(outsider,'select public.faction_battle_dashboard(30) as data')).rows[0].data;
  expect(result.members.find((m:any)=>m.id===2).latest).toBeNull();
 });
 it('does not accept user-written roster entries or direct stat/consent forgery',async()=>{
  await expect(asUser(member,`insert into private.faction_battle_shares(user_id,torn_id,faction_id) values('${outsider}',3,10)`)).rejects.toThrow('permission denied');
  await expect(asUser(member,`update public.torn_data_cache set payload='{"basic":{"leader_id":2}}'`)).rejects.toThrow('permission denied');
  await expect(asUser(member,`select * from private.faction_battle_snapshots`)).rejects.toThrow('permission denied');
 });
 it('excludes departed members even if their old consent remains',async()=>{
  await cache(leader,'v2-faction-members',{members:[{id:1,name:'Leader'}]});
  const result=(await asUser(leader,'select public.faction_battle_dashboard(30) as data')).rows[0].data;expect(result.members).toHaveLength(1);expect(JSON.stringify(result)).not.toContain('200');await verify(leader,1);
 });
 it('requires fresh matching faction proof and rejects cached loss of leadership',async()=>{
  await cache(leader,'v2-faction-basic',{basic:{id:10,leader_id:1}},'6 minutes');await expect(asUser(leader,'select public.faction_battle_dashboard(30)')).rejects.toThrow('Refresh faction verification');
  await cache(leader,'v2-faction-basic',{basic:{id:10,leader_id:2,co_leader_id:4}});await expect(asUser(leader,'select public.faction_battle_dashboard(30)')).rejects.toThrow('Only your faction leader');await verify(leader,1);
  await cache(leader,'v2-user-faction',{faction:{id:20}});await expect(asUser(leader,'select public.faction_battle_dashboard(30)')).rejects.toThrow('current faction');await verify(leader,1);
 });
 it('accepts only Torn’s actual co-leader ID and blocks a roster that excludes the viewer',async()=>{
  await cache(leader,'v2-faction-basic',{basic:{id:10,name:'Our faction',leader_id:4,co_leader_id:1}});
  expect((await asUser(leader,'select public.faction_battle_dashboard(30) as data')).rows[0].data.members.find((m:any)=>m.id===2).latest.strength).toBe('100');
  await cache(leader,'v2-faction-members',{members:[{id:2,name:'Member'}]});await expect(asUser(leader,'select public.faction_battle_dashboard(30)')).rejects.toThrow('not in this verified');await verify(leader,1);
 });
 it('retains two real observations for growth and deduplicates the same cached snapshot',async()=>{
  await db.exec(`update private.faction_battle_snapshots set observed_at=now()-interval '2 days' where user_id='${member}'`);
  await asUser(member,'select public.set_faction_battle_sharing(true)');await asUser(member,'select public.set_faction_battle_sharing(true)');
  const r=(await asUser(leader,'select public.faction_battle_dashboard(7) as data')).rows[0].data.members.find((m:any)=>m.id===2);
  expect(Date.parse(r.latest.observed_at)).toBeGreaterThan(Date.parse(r.baseline.observed_at));expect((await db.query<{n:number}>(`select count(*)::int as n from private.faction_battle_snapshots where user_id='${member}'`)).rows[0].n).toBe(2);
 });
 it('withdraws consent and deletes every shared snapshot immediately',async()=>{
  await asUser(member,'select public.set_faction_battle_sharing(false)');
  expect((await db.query<{n:number}>(`select count(*)::int as n from private.faction_battle_snapshots where user_id='${member}'`)).rows[0].n).toBe(0);
  const result=(await asUser(leader,'select public.faction_battle_dashboard(30) as data')).rows[0].data;expect(result.members.find((m:any)=>m.id===2).latest).toBeNull();
 });
 it('clears the old sharing on a newly observed departure and never follows a member into another faction',async()=>{
  await cache(member,'v2-user-faction',{faction:{id:10}});await asUser(member,'select public.set_faction_battle_sharing(true)');await cache(member,'v2-user-faction',{faction:{id:20}});
  expect((await asUser(member,'select public.my_faction_battle_sharing() as data')).rows[0].data.enabled).toBe(false);
  expect((await db.query<{n:number}>('select count(*)::int as n from private.faction_battle_snapshots')).rows[0].n).toBe(0);
 });
 it('rejects missing stats, stale membership, revoked identity and anonymous execution',async()=>{
  await cache(member,'v2-user-faction',{faction:{id:10}});await cache(member,'v2-user-battlestats',{battlestats:{strength:{value:1}}});await expect(asUser(member,'select public.set_faction_battle_sharing(true)')).rejects.toThrow('all four');
  await cache(member,'v2-user-battlestats',values);await cache(member,'v2-user-faction',{faction:{id:10}},'6 minutes');await expect(asUser(member,'select public.set_faction_battle_sharing(true)')).rejects.toThrow('verification');
  await db.exec(`update public.linked_torn_accounts set revoked_at=now() where user_id='${leader}'`);await expect(asUser(leader,'select public.faction_battle_dashboard(30)')).rejects.toThrow('identity');
  await db.exec('set role anon');try{await expect(db.query('select public.faction_battle_dashboard(30)')).rejects.toThrow('permission denied');}finally{await db.exec('reset role');}
 });
});
describe('battle stat display and growth',()=>{
 const first={strength:'9007199254740993',defense:'20',speed:'30',dexterity:'40',observed_at:'2026-11-01T00:00:00Z'};
 const m:SharedMember={id:1,name:'Member',baseline:first,latest:{...first,strength:'9007199254740995',observed_at:'2026-11-05T00:00:00Z'}};
 it('preserves integer precision beyond JavaScript safe integers',()=>{expect(compareBattleValues(m.latest!.strength,m.baseline!.strength)).toBe(1);expect(battleGrowth(m,'strength')).toBe('+2');expect(formatBattleValue('9007199254740993').replace(/\D/g,'')).toBe('9007199254740993');});
 it('does not invent growth without two comparable observations',()=>{expect(battleGrowth({...m,baseline:m.latest},'strength')).toBeNull();expect(battleGrowth({...m,latest:null},'strength')).toBeNull();expect(formatBattleValue(null)).toBe('Not shared');});
 it('supports exact decimal differences and missing-sharing filters',()=>{expect(battleGrowth({...m,baseline:{...first,strength:'1.25'},latest:{...m.latest!,strength:'1.20'}},'strength')).toBe('−0.05');expect(filterSharedMembers([m,{...m,id:2,name:'Other',latest:null}],'missing','strength','')).toHaveLength(1);});
});

async function service(sql:string,parameters:any[]=[]){await db.exec('set role service_role');try{return await db.query<any>(sql,parameters);}finally{await db.exec('reset role');}}
async function workerAction(job:any,action:string,parameters:any={}){return (await service('select public.faction_battle_worker($1,$2,$3,$4) as data',[job.user_id,job.token,action,JSON.stringify(parameters)])).rows[0].data;}
async function logPage(parameters:any,events:any[],prev:string|null=null){
 await db.query(`insert into public.torn_data_cache(user_id,request_hash,endpoint_id,parameters,payload,fetched_at) values($1,'test-log','v2-user-log',$2,$3,now()) on conflict(user_id,request_hash) do update set parameters=excluded.parameters,payload=excluded.payload,fetched_at=excluded.fetched_at`,[member,JSON.stringify(parameters),JSON.stringify({log:events,_metadata:{links:{prev,next:null}}})]);
}
describe('automatic server-side battle log estimates',()=>{
 let job:any,parameters:any;
 beforeEach(async()=>{
  await db.exec(`update public.linked_torn_accounts set revoked_at=null;delete from public.encrypted_credentials;insert into public.encrypted_credentials(user_id,provider,encrypted_key) values('${member}','torn','test-ciphertext');`);
  await asUser(member,'select public.set_faction_battle_sharing(false)');await cache(member,'v2-user-faction',{faction:{id:10}});await cache(member,'v2-user-battlestats',values,'120 seconds');await asUser(member,'select public.set_faction_battle_sharing(true)');
  await asUser(member,'select public.enable_automatic_faction_stats()');
  job=(await service('select public.claim_faction_battle_jobs() as data')).rows[0].data[0];parameters=(await workerAction(job,'prepare')).parameters;
 });
 const event=(p:any,id='gym',data:any={strength_increased:5})=>({id,timestamp:Number(p.from)+2,details:{title:'Gym train strength',category:'Gym'},data});
 it('applies explicit gains automatically when a matching log page enters the trusted backend cache',async()=>{
  await logPage(parameters,[event(parameters)]);
  const result=(await asUser(member,'select public.my_faction_battle_sharing() as data')).rows[0].data;
  expect(result.latest.strength).toBe('105');expect(result.latest.source).toBe('log_estimate');expect(result.log_sync.checked_through).toBe(Number(parameters.to));
  expect(JSON.stringify(result)).not.toContain('Gym train strength');
 });
 it('adds and subtracts exact amounts while retaining all four stats',async()=>{
  await logPage(parameters,[event(parameters,'gain',{defense_increased:2.5,speed_decreased:3,dexterity_before:400,dexterity_after:407})]);
  const r=(await asUser(member,'select public.my_faction_battle_sharing() as data')).rows[0].data.latest;expect(r.defense).toBe('202.5');expect(r.speed).toBe('297');expect(r.dexterity).toBe('407');expect(r.strength).toBe('100');
 });
 it('deduplicates repeated log IDs and makes replay of the same complete window idempotent',async()=>{
  const e=event(parameters);await logPage(parameters,[e,e]);await workerAction(job,'apply',parameters);
  const r=(await asUser(member,'select public.my_faction_battle_sharing() as data')).rows[0].data;expect(r.latest.strength).toBe('105');
  expect((await db.query<{n:number}>(`select count(*)::int n from private.faction_battle_snapshots where user_id='${member}'`)).rows[0].n).toBe(2);
 });
 it('does not partially apply a batch containing conflicting IDs or unsupported stat changes',async()=>{
  await logPage(parameters,[event(parameters),event(parameters,'gym',{strength_increased:10})]);await workerAction(job,'apply',parameters);
  const r=(await asUser(member,'select public.my_faction_battle_sharing() as data')).rows[0].data;expect(r.latest.strength).toBe('100');expect(r.log_sync.reason).toContain('Conflicting');
  expect((await db.query<{n:number}>(`select count(*)::int n from private.faction_battle_log_events where user_id='${member}'`)).rows[0].n).toBe(0);
 });
 it('requests automatic reconciliation for unknown training amounts, incomplete pages and ambiguous baseline timing',async()=>{
  await logPage(parameters,[event(parameters,'ambiguous',{energy_used:50})]);await workerAction(job,'apply',parameters);
  expect((await asUser(member,'select public.my_faction_battle_sharing() as data')).rows[0].data.log_sync.reason).toContain('no supported exact amount');
  await cache(member,'v2-user-battlestats',values,'60 seconds');await workerAction(job,'baseline');parameters=(await workerAction(job,'prepare')).parameters;
  await logPage(parameters,[event(parameters)],'https://api.torn.com/v2/user/log?nanostamp=1');
  expect((await asUser(member,'select public.my_faction_battle_sharing() as data')).rows[0].data.log_sync.reason).toContain('More log history');
  await cache(member,'v2-user-battlestats',values,'40 seconds');await workerAction(job,'baseline');parameters=(await workerAction(job,'prepare')).parameters;
  await logPage(parameters,[{...event(parameters),timestamp:Number(parameters.from)}]);
  expect((await asUser(member,'select public.my_faction_battle_sharing() as data')).rows[0].data.log_sync.reason).toContain('baseline second');
 });
 it('advances empty complete windows without manufacturing a stat change or growth snapshot',async()=>{
  await logPage(parameters,[]);const r=(await asUser(member,'select public.my_faction_battle_sharing() as data')).rows[0].data;
  expect(r.latest.source).toBe('official_api');expect(r.log_sync.checked_through).toBe(Number(parameters.to));
  expect((await db.query<{n:number}>(`select count(*)::int n from private.faction_battle_snapshots where user_id='${member}'`)).rows[0].n).toBe(1);
 });
 it('allows only the backend worker to process logs and leases each member once',async()=>{
  await expect(asUser(member,`select public.sync_faction_battle_logs('{}')`)).rejects.toThrow('permission denied');
  await expect(asUser(member,'select public.claim_faction_battle_jobs()')).rejects.toThrow('permission denied');
  expect((await service('select public.claim_faction_battle_jobs() as data')).rows[0].data).toEqual([]);
  await expect(service('select public.faction_battle_worker($1,$2,$3)',[member,'00000000-0000-4000-8000-000000000009','check'])).resolves.toHaveProperty('rows.0.faction_battle_worker.skipped',true);
 });
 it('reconciliation resets the baseline and withdrawal stops queued processing',async()=>{
  await logPage(parameters,[event(parameters,'unknown',{strength_multiplier:1.1})]);await cache(member,'v2-user-battlestats',{battlestats:{...values.battlestats,strength:{value:110}}});await workerAction(job,'baseline');
  const r=(await asUser(member,'select public.my_faction_battle_sharing() as data')).rows[0].data;expect(r.latest.strength).toBe('110');expect(r.latest.source).toBe('official_api');expect(r.log_sync.reason).toBeNull();
  await asUser(member,'select public.set_faction_battle_sharing(false)');expect((await workerAction(job,'check')).skipped).toBe(true);
  expect((await db.query<{n:number}>(`select count(*)::int n from private.faction_battle_log_state where user_id='${member}'`)).rows[0].n).toBe(0);
 });
 it('blocks coverage gaps and unavailable saved keys instead of accepting client estimates',async()=>{
  await expect(workerAction(job,'apply',{...parameters,from:String(Number(parameters.from)+5)})).rejects.toThrow('gap');
  await db.exec('delete from public.encrypted_credentials');await expect(asUser(member,'select public.enable_automatic_faction_stats()')).rejects.toThrow('Save an encrypted');
 });
});
describe('automatic worker request selection',()=>{
 const job={user_id:member,token:'lease'};
 it('fetches logs rather than all stats during normal updates',async()=>{
  const load=vi.fn(async(..._args:any[])=>{}),act=vi.fn(async(action:string)=>action==='prepare'?{parameters:{from:'1',to:'2',limit:'100'}}:{});
  expect(await runBattleJob(job,{load,act})).toBe('updated');expect(load.mock.calls.map(c=>c[0])).toEqual(['v2-user-faction','v2-user-log']);
 });
 it('automatically fetches a new baseline when the log calculation detects uncertainty',async()=>{
  const load=vi.fn(async(..._args:any[])=>{}),act=vi.fn(async(action:string)=>action==='prepare'?{parameters:{from:'1',to:'2',limit:'100'}}:action==='apply'?{needs_baseline:true}:{});
  await runBattleJob(job,{load,act});expect(load.mock.calls.map(c=>c[0])).toEqual(['v2-user-faction','v2-user-log','v2-user-battlestats']);expect(load.mock.calls[2][2]).toBe(true);
 });
 it('backs off failed keys without storing upstream errors or secrets',async()=>{
  const act=vi.fn(async(..._args:any[])=>({}));await runBattleJob(job,{act,load:async()=>{throw new Error('private-key-do-not-store');}});expect(JSON.stringify(act.mock.calls)).not.toContain('private-key-do-not-store');expect(act.mock.calls[act.mock.calls.length-1]?.[0]).toBe('finish');
 });
});
