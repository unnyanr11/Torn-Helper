import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {submissionRequest,verifiedCommunityProfile,MINIMUM_INACTIVE_SECONDS} from '../../supabase/functions/_shared/community-levelling';
import {mergeCommunityTargets,COMMUNITY_LIST} from '../lib/community-levelling';
import {filterStarterTargets} from '../lib/levelling';
const now=Date.parse('2026-11-12T04:00:00Z'),cutoff=now/1000-MINIMUM_INACTIVE_SECONDS;
const profile=(timestamp:unknown)=>({profile:{id:123,name:'InactivePlayer',level:25,last_action:{timestamp}}});
describe('official ten-day submission eligibility',()=>{
 it('accepts exactly ten days of inactivity and rejects even one second newer',()=>{
  expect(verifiedCommunityProfile(123,profile(cutoff),now).lastAction).toBe(cutoff);
  expect(verifiedCommunityProfile(123,profile(cutoff-1),now).id).toBe(123);
  for(const value of [cutoff+1,now/1000+10,null,undefined,0,-1,'100',NaN])expect(()=>verifiedCommunityProfile(123,profile(value),now)).toThrow('at least 10 days');
 });
 it('rejects mismatched profiles and client-supplied timestamps or names',async()=>{
  expect(()=>verifiedCommunityProfile(999,profile(cutoff),now)).toThrow('requested player');
  for(const extra of [{last_action_epoch:cutoff},{profile:profile(cutoff)},{player_name:'Forged'}])await expect(submissionRequest(new Request('https://app.test',{method:'POST',body:JSON.stringify({player_id:123,...extra})}))).rejects.toThrow();
  expect(await submissionRequest(new Request('https://app.test',{method:'POST',body:'{"player_id":123}'}))).toEqual({player_id:123,apiKey:undefined});
 });
 it('bounds body size and disallows unsafe or nonnumeric IDs',async()=>{
  for(const player_id of ['123',0,-1,1.5,Number.MAX_SAFE_INTEGER+1])await expect(submissionRequest(new Request('https://app.test',{method:'POST',body:JSON.stringify({player_id})}))).rejects.toThrow();
  await expect(submissionRequest(new Request('https://app.test',{method:'POST',body:'x'.repeat(1025)}))).rejects.toThrow('too large');
 });
 it('deduplicates community and Baldr players without inventing battle stats',()=>{
  const rows=[{torn_id:123,player_name:'Verified',level:25,last_action_at:new Date(cutoff*1000).toISOString(),verified_at:new Date(now).toISOString()}];
  const standalone=mergeCommunityTargets([],rows);expect(standalone[0].reportedTotal).toBeNull();
  expect(filterStarterTargets(standalone,{},1000,'All','stats',now)).toEqual([]);
  expect(filterStarterTargets(standalone,{},0,'All','stats',now,'7')).toHaveLength(1);
  const merged=mergeCommunityTargets([{id:123,name:'OldName',reportedLevel:24,reportedTotal:500,lists:["Baldr's List 1"]}],rows);
  expect(merged).toHaveLength(1);expect(merged[0]).toMatchObject({name:'Verified',reportedTotal:500,lists:["Baldr's List 1",COMMUNITY_LIST]});
 });
});
const db=new PGlite(),owner='00000000-0000-4000-8000-000000000001';
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema private;grant usage on schema private to authenticated,service_role;create table public.profiles(id uuid primary key);create table public.linked_torn_accounts(user_id uuid,revoked_at timestamptz);`);
 await db.query('insert into profiles values($1)',[owner]);await db.query('insert into linked_torn_accounts values($1,null)',[owner]);
 await db.exec(readFileSync('supabase/migrations/20261111220325_community_levelling_submissions.sql','utf8'));
});
afterAll(()=>db.close());
async function asRole(role:string,sql:string,args:any[]=[]){await db.exec(`set role ${role}`);try{return await db.query<any>(sql,args);}finally{await db.exec('reset role');}}
describe('service-only community catalogue writes',()=>{
 it('rechecks the minimum age using database time and deduplicates accepted players',async()=>{
  const threshold=(await db.query<any>("select floor(extract(epoch from clock_timestamp()-interval '240 hours'))::bigint as t")).rows[0].t;
  for(const value of [null,0,Number(threshold)+60])await expect(asRole('service_role',"select public.record_community_levelling_target($1,123,'Player',25,$2)",[owner,value])).rejects.toThrow('at least 10 days');
  await asRole('service_role',"select public.record_community_levelling_target($1,123,'Player',25,$2)",[owner,threshold]);
  await asRole('service_role',"select public.record_community_levelling_target($1,123,'Updated',25,$2)",[owner,threshold]);
  expect((await db.query<any>('select count(*)::int n from community_levelling_targets')).rows[0].n).toBe(1);
 });
 it('allows signed-in users to read verified rows but never forge one or see contributors',async()=>{
  expect((await asRole('authenticated','select torn_id,player_name,level,last_action_at,verified_at from community_levelling_targets')).rows[0].player_name).toBe('Updated');
  for(const sql of ["insert into community_levelling_targets(torn_id,player_name,level,last_action_at) values(999,'Fake',25,now()-interval '20 days')",'update community_levelling_targets set verified_at=now()','delete from community_levelling_targets','select submitted_by from community_levelling_targets',"select public.record_community_levelling_target($1,999,'Fake',25,1)"])await expect(asRole('authenticated',sql,sql.includes('$1')?[owner]:[])).rejects.toThrow('permission denied');
  await expect(asRole('anon','select torn_id from community_levelling_targets')).rejects.toThrow('permission denied');
 });
});
