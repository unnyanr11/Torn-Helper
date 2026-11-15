import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {parsePurchasePrice,validatePriceScreenshot} from '../lib/price-update';
const db=new PGlite(),alice='00000000-0000-4000-8000-000000000001',bob='00000000-0000-4000-8000-000000000002',reviewer='00000000-0000-4000-8000-000000000003';
let request:any;
async function asUser(uid:string,sql:string,params:unknown[]=[]){await db.exec(`select set_config('request.jwt.claim.sub','${uid}',false);set role authenticated;`);try{return await db.query<any>(sql,params);}finally{await db.exec('reset role');}}
const begin="select * from public.begin_foreign_price_request('Mexico','General Store',159,$1,current_date,'Shop screenshot','png')";
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;insert into auth.users values('${alice}'),('${bob}'),('${reviewer}');`);
 await db.exec(readFileSync('supabase/migrations/20261115044550_foreign_price_review.sql','utf8'));
 await db.exec(`insert into public.foreign_price_reviewers values('${reviewer}')`);
},30000);
afterAll(()=>db.close());
it('starts a private draft, requires evidence and never auto-applies a proposal',async()=>{
 request=(await asUser(alice,begin,[25])).rows[0];
 expect(request.status).toBe('draft');
 expect((await asUser(bob,'select * from public.foreign_price_requests')).rows).toEqual([]);
 await expect(asUser(alice,'select public.submit_foreign_price_request($1)',[request.id])).rejects.toThrow('Upload a screenshot');
 expect((await asUser(alice,"select buy_price from public.foreign_shop_references where country='Mexico' and item_id=159")).rows[0].buy_price).toBe(20);
 await expect(asUser(bob,"insert into storage.objects(bucket_id,name,metadata) values('foreign-price-evidence',$1,'{\"size\":100,\"mimetype\":\"image/png\"}')",[request.screenshot_path])).rejects.toThrow();
 await asUser(alice,"insert into storage.objects(bucket_id,name,metadata) values('foreign-price-evidence',$1,'{\"size\":100,\"mimetype\":\"image/png\"}')",[request.screenshot_path]);
 await asUser(alice,'select public.submit_foreign_price_request($1)',[request.id]);
 expect((await asUser(bob,'select * from storage.objects')).rows).toEqual([]);
 expect((await asUser(reviewer,'select * from storage.objects')).rows).toHaveLength(1);
 await expect(asUser(alice,"update storage.objects set name='replacement' where name=$1 returning *",[request.screenshot_path])).resolves.toMatchObject({rows:[]});
});
it('protects approvals and allowlists even when a client bypasses the UI',async()=>{
 await expect(asUser(alice,'insert into public.foreign_price_reviewers values($1)',[alice])).rejects.toThrow();
 await expect(asUser(alice,'select public.review_foreign_price_request($1,true,26,\'fake\')',[request.id])).rejects.toThrow('Owner reviewer access required');
 await expect(asUser(alice,'update public.foreign_shop_references set buy_price=1')).rejects.toThrow();
 await expect(asUser(alice,"update public.foreign_price_requests set status='approved' where id=$1",[request.id])).rejects.toThrow();
});
it('applies a corrected approved value atomically and preserves evidence and decisions',async()=>{
 await asUser(reviewer,"select public.review_foreign_price_request($1,true,27,'Checked screenshot')",[request.id]);
 const ref=(await asUser(alice,"select * from public.foreign_shop_references where country='Mexico' and item_id=159")).rows[0];
 expect(ref.buy_price).toBe(27);expect(ref.revision).toBe(1);expect(ref.source).toBe('Owner-verified screenshot');
 const row=(await asUser(alice,'select * from public.foreign_price_requests where id=$1',[request.id])).rows[0];
 expect(row).toMatchObject({old_price:20,proposed_price:25,applied_price:27,status:'approved',reviewed_by:reviewer,review_note:'Checked screenshot'});
 await expect(asUser(reviewer,'select public.review_foreign_price_request($1,true,28,\'again\')',[request.id])).rejects.toThrow('no longer pending');
});
it('rejects stale approvals and supports rejection without touching the price',async()=>{
 const a=(await asUser(alice,begin,[30])).rows[0],b=(await asUser(alice,begin,[31])).rows[0];
 for(const r of [a,b]){await asUser(alice,"insert into storage.objects(bucket_id,name,metadata) values('foreign-price-evidence',$1,'{\"size\":100,\"mimetype\":\"image/png\"}')",[r.screenshot_path]);await asUser(alice,'select public.submit_foreign_price_request($1)',[r.id]);}
 await asUser(reviewer,"select public.review_foreign_price_request($1,true,null,'First')",[a.id]);
 await expect(asUser(reviewer,"select public.review_foreign_price_request($1,true,null,'stale')",[b.id])).rejects.toThrow('approved first');
 await asUser(reviewer,"select public.review_foreign_price_request($1,false,null,'Please send fresh evidence')",[b.id]);
 expect((await asUser(alice,"select buy_price from public.foreign_shop_references where country='Mexico' and item_id=159")).rows[0].buy_price).toBe(30);
});
it('enforces upload restrictions and server-side rate limits',async()=>{
 for(let i=0;i<5;i++)await asUser(bob,begin,[100+i]);
 await expect(asUser(bob,begin,[200])).rejects.toThrow('5 price requests');
 const bucket=(await db.query<any>("select * from storage.buckets where id='foreign-price-evidence'")).rows[0];
 expect(bucket.public).toBe(false);expect(bucket.file_size_limit).toBe(5242880);expect(bucket.allowed_mime_types).toEqual(['image/jpeg','image/png','image/webp']);
 await expect(asUser(alice,"select public.begin_foreign_price_request('Fake','General Store',159,55,current_date,'','png')")).rejects.toThrow('Unknown');
 await expect(asUser(alice,"select public.begin_foreign_price_request('Mexico','General Store',159,55,current_date+1,'','png')")).rejects.toThrow('30 days');
});
it('validates whole-dollar prices and image signatures without accepting renamed SVG',async()=>{
 expect(parsePurchasePrice('25000000000')).toBe(25000000000);
 for(const value of ['','NaN','1.5','1e3','-1','100000000000001'])expect(()=>parsePurchasePrice(value)).toThrow();
 const png=new Blob([new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])],{type:'image/png'});
 await expect(validatePriceScreenshot(png)).resolves.toBe('png');
 await expect(validatePriceScreenshot(new Blob(['<svg></svg>'],{type:'image/png'}))).rejects.toThrow('real PNG');
 await expect(validatePriceScreenshot({size:5242881,type:'image/png',slice:()=>png})).rejects.toThrow('5 MB');
});
