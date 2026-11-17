import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,it,expect} from 'vitest';
const db=new PGlite(),host='00000000-0000-4000-8000-000000000001',user='00000000-0000-4000-8000-000000000002',other='00000000-0000-4000-8000-000000000003',campaign='00000000-0000-4000-8000-000000000011',restricted='00000000-0000-4000-8000-000000000012';
async function asUser(uid:string,sql:string){await db.exec(`select set_config('request.jwt.claim.sub','${uid}',false);set role authenticated;`);try{return await db.query<any>(sql);}finally{await db.exec('reset role');}}
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;create table public.linked_torn_accounts(user_id uuid,torn_id bigint,torn_name text,revoked_at timestamptz);create table public.lucky_draw_campaigns(id uuid primary key,host_user_id uuid,closes_at timestamptz,cancelled_at timestamptz,drawn_at timestamptz,audience text,pool_quantity bigint default 0);grant select on public.lucky_draw_campaigns to authenticated;create function public.lucky_draw_action(action text,campaign uuid,payload jsonb) returns jsonb language plpgsql as $$begin if (select audience from public.lucky_draw_campaigns where id=campaign)='faction' then raise exception 'Faction membership required';end if;return '{"eligible":true}'::jsonb;end$$;insert into auth.users values('${host}'),('${user}'),('${other}');insert into public.linked_torn_accounts values('${host}',1,'Host',null),('${user}',2,'Player',null);insert into public.lucky_draw_campaigns(id,host_user_id,closes_at,audience) values('${campaign}','${host}',now()+interval '1 day','all'),('${restricted}','${host}',now()+interval '1 day','faction');`);
 await db.exec(readFileSync('supabase/migrations/20261117164411_lucky_draw_enrollment.sql','utf8'));
},30000);
afterAll(()=>db.close());
it('enrolls once using the signed-in verified identity without changing the prize pool',async()=>{
 for(let i=0;i<2;i++)await asUser(user,`select public.enroll_lucky_draw('${campaign}')`);
 expect((await asUser(user,'select * from public.lucky_draw_enrollments')).rows).toHaveLength(1);
 expect((await asUser(host,'select * from public.lucky_draw_enrollments')).rows[0]).toMatchObject({user_id:user,torn_id:2,player_name:'Player'});
 expect((await asUser(other,'select * from public.lucky_draw_enrollments')).rows).toEqual([]);
 expect((await db.query<any>(`select pool_quantity from public.lucky_draw_campaigns where id='${campaign}'`)).rows[0].pool_quantity).toBe(0);
 await expect(asUser(user,'insert into public.lucky_draw_enrollments(campaign_id,user_id,torn_id,player_name) values(gen_random_uuid(),gen_random_uuid(),99,\'forged\')')).rejects.toThrow();
});
it('rejects host enrollment, unverified accounts and restricted audiences',async()=>{
 await expect(asUser(host,`select public.enroll_lucky_draw('${campaign}')`)).rejects.toThrow('Hosts');
 await expect(asUser(other,`select public.enroll_lucky_draw('${campaign}')`)).rejects.toThrow('verified Torn');
 await expect(asUser(user,`select public.enroll_lucky_draw('${restricted}')`)).rejects.toThrow('Faction membership');
});
it('rejects new enrollment after closing and blocks anonymous execution',async()=>{
 await db.exec(`update public.lucky_draw_campaigns set audience='all',closes_at=now()-interval '1 minute' where id='${restricted}'`);
 await expect(asUser(user,`select public.enroll_lucky_draw('${restricted}')`)).rejects.toThrow('closed');
 await db.exec('set role anon');try{await expect(db.query(`select public.enroll_lucky_draw('${campaign}')`)).rejects.toThrow();}finally{await db.exec('reset role');}
});
