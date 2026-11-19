import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
import {beforeAll,afterAll,it,expect} from 'vitest';
const db=new PGlite(),at='2026-11-19T18:20:00Z',hours=[1,3,6,12,18,24,168,336,504,672];
const charts=Array.from({length:35},(_,i)=>({stock_id:i+1,forecast:{points:[],model:'test'},processing_ms:1}));
const results=charts.flatMap(row=>hours.map(horizon_hours=>({stock_id:row.stock_id,horizon_hours,forecast:{horizonHours:horizon_hours,model:'test'},processing_ms:1})));
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema private;create schema cron;create function cron.schedule(text,text,text) returns bigint language sql as 'select 1::bigint';create table public.stock_collection_status(id int,provider_at timestamptz);create table public.stock_minute_prices(stock_id int,price numeric,observed_at timestamptz);grant select on public.stock_collection_status,public.stock_minute_prices to service_role,authenticated;insert into public.stock_collection_status values(1,'${at}');insert into public.stock_minute_prices values(1,100,'2026-11-19T17:00:00Z'),(1,110,'${at}');`);
 for(const suffix of ['_long_term_stock_analysis.sql','_stock_long_term_hourly_cache.sql','_stock_trading_forecast_horizons.sql']){
  const file=readdirSync('supabase/migrations').find(n=>n.endsWith(suffix))!;await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
 }
});
afterAll(()=>db.close());
it('requires all ten distinct horizons for all 35 stocks and matching model metadata',async()=>{
 await expect(db.query('select public.publish_stock_horizons($1,now(),$2::jsonb,$3::jsonb)',[at,JSON.stringify(results.slice(1)),JSON.stringify(charts)])).rejects.toThrow('Complete 350-forecast batch required');
 const mismatch=results.map((r,i)=>i===0?{...r,forecast:{horizonHours:24}}:r);
 await expect(db.query('select public.publish_stock_horizons($1,now(),$2::jsonb,$3::jsonb)',[at,JSON.stringify(mismatch),JSON.stringify(charts)])).rejects.toThrow('Forecast horizon mismatch');
 await db.query('select public.publish_stock_horizons($1,now(),$2::jsonb,$3::jsonb)',[at,JSON.stringify(results),JSON.stringify(charts)]);
 const {rows}=await db.query<any>('select count(*) forecasts,count(distinct horizon_hours) horizons from public.stock_horizon_results');expect(rows[0]).toEqual({forecasts:350,horizons:10});
});
it('gives signed-in clients read-only access and blocks public publication',async()=>{
 const {rows}=await db.query<any>(`select has_table_privilege('authenticated','public.stock_horizon_results','select') read,has_table_privilege('authenticated','public.stock_horizon_results','insert') write,has_table_privilege('anon','public.stock_horizon_results','select') anonymous,has_function_privilege('authenticated','public.publish_stock_horizons(timestamptz,timestamptz,jsonb,jsonb)','execute') publish`);
 expect(rows[0]).toEqual({read:true,write:false,anonymous:false,publish:false});
});
it('returns a comparison opening price so movement amount and percent use one fixed baseline',async()=>{
 const {rows}=await db.query<any>('select public.read_stock_window_extremes(1440) data');expect(rows[0].data.stocks[0].open).toBe(100);
});
it('keeps hourly outcomes older than raw-minute retention for long-horizon validation',async()=>{
 await db.exec(`insert into private.stock_hourly_closes values(1,'2026-09-20T17:00:00Z','2026-09-20T17:59:00Z',90)`);
 const {rows}=await db.query<any>('select public.read_stock_long_term_input() data');expect(rows[0].data.stocks['1'][0][1]).toBe(90);
});
