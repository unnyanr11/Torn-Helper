import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,it,expect} from 'vitest';
const db=new PGlite();
async function role<T>(name:string,body:()=>Promise<T>){await db.exec(`set role ${name}`);try{return await body();}finally{await db.exec('reset role');}}
let lease:string,ts:number;
const points=(time:number)=>Array.from({length:35},(_,i)=>({stock_id:i+1,timestamp:time,price:100+i,total_shares:1000}));
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema private;grant usage on schema private to service_role;create schema auth;create function auth.uid() returns uuid language sql as $$select null::uuid$$;create schema cron;create function cron.schedule(text,text,text) returns integer language sql as $$select 1$$;`);
 await db.exec(readFileSync('supabase/migrations/20261116124032_stock_minute_history.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261116131117_stock_week_window.sql','utf8'));
 const now=(await db.query<any>("select extract(epoch from date_trunc('minute',now()))::integer ts")).rows[0].ts;ts=now;
},30000);
afterAll(()=>db.close());
it('allows authenticated market reads but prevents fabricated minute uploads',async()=>{
 await role('authenticated',async()=>{
  expect((await db.query('select * from public.stock_minute_prices')).rows).toEqual([]);
  await expect(db.query('select public.claim_stock_collection()')).rejects.toThrow();
  await expect(db.query("insert into public.stock_minute_prices(stock_id,observed_at,price) values(1,date_trunc('minute',now()),1)")).rejects.toThrow();
 });
 await role('anon',async()=>{await expect(db.query('select * from public.stock_minute_prices')).rejects.toThrow();});
});
it('leases one scheduled collection per minute and refuses unauthorized tokens',async()=>{
 const c=await role('service_role',()=>db.query<any>('select public.claim_stock_collection() as claim'));lease=c.rows[0].claim.lease;
 expect(c.rows[0].claim.backfill_id).toBe(1);
 expect((await role('service_role',()=>db.query<any>('select public.claim_stock_collection() as claim'))).rows[0].claim).toBeNull();
 await expect(role('service_role',()=>db.query('select public.finish_stock_collection($1,to_timestamp($2),$3::jsonb,false,null)',['00000000-0000-4000-8000-000000000000',ts,JSON.stringify(points(ts))]))).rejects.toThrow('lease');
});
it('validates complete fresh batches before atomically recording immutable observations',async()=>{
 await expect(role('service_role',()=>db.query('select public.finish_stock_collection($1,to_timestamp($2),$3::jsonb,false,null)',[lease,ts,JSON.stringify(points(ts).slice(1))]))).rejects.toThrow('Incomplete');
 await expect(role('service_role',()=>db.query('select public.finish_stock_collection($1,to_timestamp($2),$3::jsonb,false,null)',[lease,ts-300,JSON.stringify(points(ts-300))]))).rejects.toThrow('stale');
 const data=[...points(ts),{stock_id:1,timestamp:ts-120,price:90,total_shares:null}];
 const result=await role('service_role',()=>db.query<any>('select public.finish_stock_collection($1,to_timestamp($2),$3::jsonb,true,null) written',[lease,ts,JSON.stringify(data)]));
 expect(result.rows[0].written).toBe(36);
 const history=await role('authenticated',()=>db.query<any>('select public.read_stock_minute_history(1) points'));
 expect(history.rows[0].points.map((p:any)=>p.timestamp)).toEqual([ts-120,ts]);
 expect(history.rows[0].points[0].price).toBe(90);
 expect((await role('authenticated',()=>db.query<any>('select * from public.stock_collection_status'))).rows[0].backfilled_stocks).toBe(1);
 await role('authenticated',async()=>{await expect(db.query('update public.stock_minute_prices set price=1')).rejects.toThrow();});
});
it('retains previous data on provider failure and never fabricates a missing minute',async()=>{
 await db.exec("update private.stock_collection_control set last_slot=null,lease_until=null");
 const c=(await role('service_role',()=>db.query<any>('select public.claim_stock_collection() claim'))).rows[0].claim;
 await role('service_role',()=>db.query('select public.finish_stock_collection($1,null,\'[]\'::jsonb,false,\'network\')',[c.lease]));
 expect((await db.query<any>('select count(*)::integer n from public.stock_minute_prices')).rows[0].n).toBe(36);
 expect((await db.query<any>("select count(*)::integer n from public.stock_minute_prices where observed_at=to_timestamp($1)",[ts-60])).rows[0].n).toBe(0);
 expect((await db.query<any>('select message from public.stock_collection_status')).rows[0].message).toContain('previous observations retained');
});
it('reads more than 2,000 weekly minutes and excludes older archive prices',async()=>{
 await db.query('insert into public.stock_minute_prices(stock_id,observed_at,price) select 1,to_timestamp($1-i*60),100 from generate_series(0,2099) i on conflict do nothing',[ts]);
 await db.query('insert into public.stock_minute_prices(stock_id,observed_at,price) values(1,to_timestamp($1-8*86400),100)',[ts]);
 const result=await role('authenticated',()=>db.query<any>('select public.read_stock_minute_history(1) points'));
 expect(result.rows[0].points).toHaveLength(2100);
 expect(result.rows[0].points.every((p:any)=>p.timestamp>ts-7*86400)).toBe(true);
});
