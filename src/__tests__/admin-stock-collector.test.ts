import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {officialStockMinutes} from '../../supabase/functions/_shared/stock-minute-feed';
import {STOCKS} from '../data/stocks';
const db=new PGlite(),owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
async function asUser(uid:string,sql:string){await db.exec(`select set_config('request.jwt.claim.sub','${uid}',false);set role authenticated;`);try{return await db.query<any>(sql);}finally{await db.exec('reset role');}}
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema private;create schema auth;create schema cron;grant usage on schema private to service_role;grant usage on schema auth to authenticated;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function cron.schedule(text,text,text) returns integer language sql as $$select 1$$;create table auth.users(id uuid primary key);create table public.profiles(id uuid primary key,role text,tracking_paused boolean default false);create table public.linked_torn_accounts(user_id uuid primary key,revoked_at timestamptz,key_access_level text);create table public.encrypted_credentials(user_id uuid,provider text,encrypted_key text);insert into auth.users values('${owner}'),('${other}');insert into public.profiles(id,role) values('${owner}','admin'),('${other}','user');`);
 for(const file of ['20261116124032_stock_minute_history.sql','20261116131117_stock_week_window.sql','20261116132227_admin_stock_collector.sql'])await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
},30000);
afterAll(()=>db.close());
it('does not let ordinary users choose collector credentials or read owner configuration',async()=>{
 await expect(asUser(other,'select public.configure_stock_collector(true)')).rejects.toThrow('Administrator required');
 await expect(asUser(other,'select public.get_stock_collector_owner()')).rejects.toThrow();
 await expect(asUser(other,'select * from private.stock_collector_owner')).rejects.toThrow();
});
it('requires an active saved admin key, enables only their own identity, and respects pausing',async()=>{
 await expect(asUser(owner,'select public.configure_stock_collector(true)')).rejects.toThrow('Full Access');
 await db.exec(`insert into public.linked_torn_accounts(user_id,key_access_level) values('${owner}','Full Access');insert into public.encrypted_credentials values('${owner}','torn','encrypted-test-value');`);
 await asUser(owner,'select public.configure_stock_collector(true)');
 expect((await db.query<any>('select public.get_stock_collector_owner() id')).rows[0].id).toBe(owner);
 await db.exec(`update public.profiles set tracking_paused=true where id='${owner}'`);
 expect((await db.query<any>('select public.get_stock_collector_owner() id')).rows[0].id).toBeNull();
 await db.exec(`update public.profiles set tracking_paused=false where id='${owner}'`);
 await asUser(owner,'select public.configure_stock_collector(false)');
 expect((await db.query<any>('select public.get_stock_collector_owner() id')).rows[0].id).toBeNull();
});
it('validates official current quotes and distinguishes observation time from exchange time',()=>{
 const payload={stocks:STOCKS.map(s=>({id:s.id,market:{price:100,shares:1000}}))};
 const r=officialStockMinutes(payload,1794833407);expect(r.points).toHaveLength(35);expect(r.timestamp).toBe(1794833400);expect(r.points.every(p=>p.source==='Torn API')).toBe(true);
 expect(()=>officialStockMinutes({stocks:payload.stocks.slice(1)},1794833407)).toThrow('Incomplete');
});
it('preserves official-source provenance in both the archive and public collector status',async()=>{
 const claimed=(await db.query<any>('select public.claim_stock_collection() c')).rows[0].c;
 const ts=(await db.query<any>("select extract(epoch from date_trunc('minute',now()))::integer ts")).rows[0].ts;
 const points=officialStockMinutes({stocks:STOCKS.map(s=>({id:s.id,market:{price:100,shares:1000}}))},ts).points;
 await db.query('select public.finish_stock_collection($1,to_timestamp($2),$3::jsonb,false,null)',[claimed.lease,ts,JSON.stringify(points)]);
 expect((await db.query<any>('select quote_source from public.stock_collection_status')).rows[0].quote_source).toBe('Torn API');
 expect((await db.query<any>('select distinct source from public.stock_minute_prices')).rows).toEqual([{source:'Torn API'}]);
});
