import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,it,expect} from 'vitest';
const db=new PGlite();
const anchor='2026-11-19T18:00:00Z';
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role;create table public.stock_collection_status(id int,provider_at timestamptz);create table public.stock_minute_prices(stock_id int,price numeric,observed_at timestamptz);grant select on public.stock_collection_status,public.stock_minute_prices to authenticated,service_role;insert into public.stock_collection_status values(1,'${anchor}');`);
 await db.exec(readFileSync('supabase/migrations/20261119184434_stock_window_extremes.sql','utf8'));
 await db.exec(`insert into public.stock_minute_prices values(1,1,'2026-11-18T18:00:00Z'),(1,100,'2026-11-18T19:00:00Z'),(1,120,'2026-11-19T10:00:00Z'),(1,100,'2026-11-19T11:00:00Z'),(1,110,'${anchor}'),(1,9999,'2026-11-19T18:01:00Z'),(2,50,'${anchor}');`);
});
afterAll(()=>db.close());
it('finds all stocks in one snapshot, ignores boundaries/future quotes and resolves ties by latest time',async()=>{
 const {rows}=await db.query<any>(`select public.read_stock_window_extremes(1440) data`);const data=rows[0].data;
 expect(data.stocks).toHaveLength(2);const first=data.stocks[0];
 expect(first.low).toBe(100);expect(first.high).toBe(120);expect(Date.parse(first.low_at)).toBe(Date.parse('2026-11-19T11:00:00Z'));expect(first.observed_points).toBe(4);
});
it('supports matching an earlier displayed quote and a shorter comparison window',async()=>{
 const {rows}=await db.query<any>(`select public.read_stock_window_extremes(60,'2026-11-19T10:00:00Z') data`);
 expect(rows[0].data.stocks[0].high).toBe(120);expect(rows[0].data.stocks[0].low).toBe(120);
 await expect(db.query(`select public.read_stock_window_extremes(999999)`)).rejects.toThrow('Unsupported comparison window');
 const {rows:perms}=await db.query<any>(`select has_function_privilege('anon','public.read_stock_window_extremes(integer,timestamptz)','EXECUTE') anonymous,has_function_privilege('authenticated','public.read_stock_window_extremes(integer,timestamptz)','EXECUTE') member`);
 expect(perms[0]).toEqual({anonymous:false,member:true});
});
