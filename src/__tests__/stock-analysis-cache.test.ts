import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,it,expect} from 'vitest';
const db=new PGlite();
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema private;create schema vault;create schema net;create schema cron;create function cron.schedule(name text,schedule text,command text) returns bigint language sql as $$select 1::bigint$$;grant usage on schema private to service_role;create table vault.decrypted_secrets(name text,decrypted_secret text);create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as $$select 1::bigint$$;create publication supabase_realtime;create table public.stock_minute_prices(stock_id integer,observed_at timestamptz,price numeric);create table public.stock_collection_status(id int,provider_at timestamptz,backfilled_stocks int);insert into public.stock_collection_status values(1,now(),35);`);
 await db.exec(readFileSync('supabase/migrations/20261119153711_cached_stock_analysis.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261119153956_stock_analysis_batches.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261119154328_stock_analysis_queue.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261119154951_stock_analysis_dispatch.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261119160836_stock_chart_and_fast_analysis.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261119171329_fast_stock_inference.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261119171619_stock_training_compatibility.sql','utf8'));
});
afterAll(()=>db.close());
it('restricts analysis jobs and writes to service role while members can read',async()=>{
 const {rows}=await db.query<{read:boolean;write:boolean;claim:boolean}>(`select has_table_privilege('authenticated','public.stock_analysis_results','SELECT') as read,has_table_privilege('authenticated','public.stock_analysis_results','INSERT') as write,has_function_privilege('authenticated','public.claim_stock_analysis(integer,text)','EXECUTE') as claim`);
 expect(rows[0]).toEqual({read:true,write:false,claim:false});
 const {rows:anon}=await db.query<{read:boolean}>(`select has_table_privilege('anon','public.stock_analysis_results','SELECT') as read`);expect(anon[0].read).toBe(false);
});
it('deduplicates work, rejects other leases, and stores four compact results atomically',async()=>{
 const {rows}=await db.query<{claim:{lease:string}}>(`select public.claim_stock_analysis(1,'test-v1') claim`);
 const token=rows[0].claim.lease;
 expect((await db.query<{claim:unknown}>(`select public.claim_stock_analysis(1,'test-v1') claim`)).rows[0].claim).toBeNull();
 expect((await db.query<{done:boolean}>(`select public.finish_stock_analysis(1,gen_random_uuid(),null) done`)).rows[0].done).toBe(false);
 const payload=[1,5,15,60].map(horizon=>({horizon,forecast:{points:[]},processing_ms:1,history_from:1,history_to:2}));
 await db.query(`select public.finish_stock_analysis(1,$1,$2::jsonb)`,[token,JSON.stringify(payload)]);
 expect((await db.query(`select * from public.stock_analysis_results where stock_id=1`)).rows).toHaveLength(4);
 expect((await db.query<{claim:unknown}>(`select public.claim_stock_analysis(1,'test-v1') claim`)).rows[0].claim).toBeNull();
 expect((await db.query<{done:boolean}>(`select public.finish_stock_analysis(1,$1,$2::jsonb) done`,[token,JSON.stringify(payload)])).rows[0].done).toBe(false);
});

it('reserves queued jobs so the next dispatch does not repeat pending requests',async()=>{
 await db.exec(`insert into vault.decrypted_secrets values('tcc_job_token','local-test-token');select private.enqueue_stock_analyses();select private.enqueue_stock_analyses();`);
 const {rows}=await db.query<{count:number}>(`select count(*)::integer count from private.stock_analysis_jobs where queued_until>now()`);
 expect(rows[0].count).toBe(14);
});

it('returns compact week prices in order and only deltas after the cursor',async()=>{
 await db.exec(`insert into public.stock_minute_prices values(2,date_trunc('minute',now())-interval '1 minute',100),(2,date_trunc('minute',now()),101),(3,now(),999);`);
 const {rows}=await db.query<{data:{points:[number,number][]}}>(`select public.read_stock_chart_history(2) data`);
 expect(rows[0].data.points.map(p=>p[1])).toEqual([100,101]);
 const after=rows[0].data.points[0][0];
 const delta=await db.query<{data:{points:[number,number][]}}>(`select public.read_stock_chart_history(2,$1) data`,[after]);
 expect(delta.rows[0].data.points.map(p=>p[1])).toEqual([101]);
});

it('publishes all stocks atomically and restricts fast inference to the service',async()=>{
 const perms=await db.query<{allowed:boolean}>(`select has_function_privilege('authenticated','public.read_stock_inference_input()','EXECUTE') allowed`);expect(perms.rows[0].allowed).toBe(false);
 await db.exec(`update public.stock_collection_status set provider_at=date_trunc('minute',now()) where id=1`);
 const {rows}=await db.query<{at:string;stamp:number}>(`select provider_at::text at,extract(epoch from provider_at)::bigint::float8 stamp from public.stock_collection_status where id=1`);
 const payload=Array.from({length:35},(_,i)=>[1,5,15,60].map(horizon=>({stock_id:i+1,horizon,forecast:{last:{timestamp:rows[0].stamp,price:100},points:[]},processing_ms:1,history_from:null,history_to:null}))).flat();
 await expect(db.query(`select public.publish_stock_inference($1,'server-minute-v5-cached-inference',now(),$2::jsonb)`,[rows[0].at,JSON.stringify(payload.slice(1))])).rejects.toThrow('140');
 await db.query(`select public.publish_stock_inference($1,'server-minute-v5-cached-inference',now(),$2::jsonb)`,[rows[0].at,JSON.stringify(payload)]);
 expect((await db.query<{forecast_count:number}>(`select forecast_count from public.stock_analysis_status`)).rows[0].forecast_count).toBe(140);
});
