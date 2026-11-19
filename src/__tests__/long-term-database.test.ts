import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
import {beforeAll,afterAll,it,expect} from 'vitest';
const db=new PGlite();const anchor='2026-11-19T18:20:00Z';
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema private;create schema cron;create function cron.schedule(text,text,text) returns bigint language sql as 'select 1::bigint';create table public.stock_collection_status(id int,provider_at timestamptz);create table public.stock_minute_prices(stock_id int,price numeric,observed_at timestamptz);grant select on public.stock_collection_status,public.stock_minute_prices to service_role,authenticated;insert into public.stock_collection_status values(1,'${anchor}');insert into public.stock_minute_prices values(1,99,'2026-10-18T18:00:00Z'),(1,100,'2026-11-19T17:00:00Z'),(1,105,'2026-11-19T17:59:00Z'),(1,110,'${anchor}'),(1,999,'2026-11-19T18:21:00Z'),(2,50,'${anchor}');`);
 const file=readdirSync('supabase/migrations').find(n=>n.endsWith('_long_term_stock_analysis.sql'))!;
 await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
 const cache=readdirSync('supabase/migrations').find(n=>n.endsWith('_stock_long_term_hourly_cache.sql'))!;
 await db.exec(readFileSync('supabase/migrations/'+cache,'utf8'));
});
afterAll(()=>db.close());
it('reads hourly closes for all stocks together and excludes future and expired quotes',async()=>{
 const {rows}=await db.query<any>('select public.read_stock_long_term_input() data');
 expect(Object.keys(rows[0].data.stocks)).toHaveLength(2);
 expect(rows[0].data.stocks['1'].map((p:any[])=>p[1])).toEqual([105,110]);
});
it('restricts analysis input/publication to the backend and lets signed-in users read the saved cache',async()=>{
 const {rows}=await db.query<any>(`select has_function_privilege('authenticated','public.read_stock_long_term_input()','execute') input,has_function_privilege('authenticated','public.publish_stock_long_term(timestamptz,timestamptz,jsonb)','execute') publish,has_table_privilege('authenticated','public.stock_long_term_results','select') read,has_table_privilege('authenticated','public.stock_long_term_results','update') write,has_table_privilege('anon','public.stock_long_term_results','select') anonymous`);
 expect(rows[0]).toEqual({input:false,publish:false,read:true,write:false,anonymous:false});
});
it('requires complete atomic batches and does not overwrite newer saved results',async()=>{
 await expect(db.query(`select public.publish_stock_long_term('${anchor}',now(),'[]'::jsonb)`)).rejects.toThrow('Complete 35-stock analysis required');
 const results=Array.from({length:35},(_,i)=>({stock_id:i+1,forecast:{points:[],model:'test'},processing_ms:1}));
 await db.query('select public.publish_stock_long_term($1,now(),$2::jsonb)',[anchor,JSON.stringify(results)]);
 await db.query("select public.publish_stock_long_term($1,now(),$2::jsonb)",['2026-11-19T17:00:00Z',JSON.stringify(results)]);
 const {rows}=await db.query<any>('select count(*) n,min(provider_at) oldest from public.stock_long_term_results');expect(rows[0].n).toBe(35);expect(Date.parse(rows[0].oldest)).toBe(Date.parse(anchor));
 await db.exec('set role authenticated');const read=await db.query<any>('select count(*) n from public.stock_long_term_results');expect(read.rows[0].n).toBe(35);await db.exec('reset role');
});
