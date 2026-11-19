import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
import {beforeAll,afterAll,it,expect} from 'vitest';
const db=new PGlite(),anchor='2026-11-19T20:00:00Z';
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema cron;create table cron.job(jobid bigint,jobname text,active boolean);create function cron.alter_job(job_id bigint,schedule text default null,command text default null,database text default null,username text default null,active boolean default null) returns void language sql as 'update cron.job set active=$6 where jobid=$1';insert into cron.job values(1,'stock-analysis-batches',true),(2,'collect-stock-minutes',true),(3,'long-term-stock-analysis',true),(4,'prune-stock-minutes',true);create table public.stock_collection_status(id int,provider_at timestamptz);create table public.stock_minute_prices(stock_id int,price numeric,observed_at timestamptz,primary key(stock_id,observed_at));grant select on public.stock_collection_status,public.stock_minute_prices to authenticated,service_role;insert into public.stock_collection_status values(1,'${anchor}');insert into public.stock_minute_prices select stock,stock*100+minute,'${anchor}'::timestamptz-(300-minute)*interval '1 minute' from generate_series(1,35) stock cross join generate_series(0,300) minute;insert into public.stock_minute_prices values(1,99999,'${anchor}'::timestamptz+interval '1 minute');`);
 const migration=readdirSync('supabase/migrations').find(n=>n.endsWith('_reduce_stock_disk_io.sql'))!;await db.exec(readFileSync('supabase/migrations/'+migration,'utf8'));
});
afterAll(()=>db.close());
it.each([15,30,60,120,180,360,720,1080,1440,10080,43200])('matches the recorded opening quote for all stocks in the %i-minute window',async minutes=>{
 const {rows}=await db.query<any>('select public.read_stock_window_openings($1) data',[minutes]);
 expect(rows[0].data.stocks).toHaveLength(35);const offset=Math.max(0,301-minutes);
 for(const row of rows[0].data.stocks)expect(row.open).toBe(row.stock_id*100+offset);
});
it('preserves snapshot matching and rejects invalid windows',async()=>{
 const {rows}=await db.query<any>(`select public.read_stock_window_openings(60,'${anchor}'::timestamptz-interval '1 hour') data`);
 expect(rows[0].data.stocks[0].open).toBe(281);
 await expect(db.query('select public.read_stock_window_openings(100000)')).rejects.toThrow('Unsupported comparison window');
});
it('disables the retired job while preserving current collection, forecasts and retention',async()=>{
 const {rows}=await db.query<any>('select jobname,active from cron.job order by jobid');expect(rows.map(r=>r.active)).toEqual([false,true,true,true]);
});
it('retains signed-in read access and denies anonymous function calls',async()=>{
 const {rows}=await db.query<any>(`select has_function_privilege('anon','public.read_stock_window_openings(integer,timestamptz)','execute') anonymous,has_function_privilege('authenticated','public.read_stock_window_openings(integer,timestamptz)','execute') signed_in`);
 expect(rows[0]).toEqual({anonymous:false,signed_in:true});
});
