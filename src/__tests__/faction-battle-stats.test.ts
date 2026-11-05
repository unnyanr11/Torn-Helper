import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
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
 create table public.torn_data_cache(user_id uuid,request_hash text,endpoint_id text,parameters jsonb,payload jsonb,fetched_at timestamptz,primary key(user_id,request_hash));
 insert into public.profiles(id) values('${leader}'),('${member}'),('${outsider}');
 insert into public.linked_torn_accounts(user_id,torn_id) values('${leader}',1),('${member}',2),('${outsider}',3);`);
 await db.exec(readFileSync('supabase/migrations/20261105093823_faction_battle_stat_sharing.sql','utf8'));
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
  const stats=result.members.find((m:any)=>m.id===2).latest;expect(stats.strength).toBe('100');expect(stats.defense).toBe('200');expect(stats.speed).toBe('300');expect(stats.dexterity).toBe('400');expect(Object.keys(stats).sort()).toEqual(['defense','dexterity','observed_at','speed','strength']);
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
