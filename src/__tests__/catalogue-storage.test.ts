import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll,afterAll,describe,it,expect } from 'vitest';
const db=new PGlite();
async function role(name:string,sql:string,params:unknown[]=[]){await db.exec(`set role ${name}`);try{return await db.query<any>(sql,params);}finally{await db.exec('reset role');}}
beforeAll(async()=>{await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema private;grant usage on schema private to service_role;create table public.torn_data_cache(endpoint_id text,parameters jsonb,payload jsonb);grant all on public.torn_data_cache to service_role;');await db.exec(readFileSync('supabase/migrations/20261022050717_persistent_item_catalogue.sql','utf8'));await db.exec(readFileSync('supabase/migrations/20261022051838_persist_catalogue_from_gateway.sql','utf8'));});
afterAll(()=>db.close());
const items=Array.from({length:1205},(_,i)=>({id:i+1,name:`Test item ${i+1}`,type:'Weapon',sub_type:i%2?'Primary':'Secondary'}));
let token:string;
describe('permanent reference catalogue database boundaries',()=>{
 it('allows signed-in reads while denying anonymous reads and client writes',async()=>{
  expect((await role('authenticated','select public.get_torn_item_catalogue() as data')).rows[0].data.item_count).toBe(0);
  await expect(role('anon','select public.get_torn_item_catalogue()')).rejects.toThrow();
  await expect(role('authenticated',"insert into public.torn_item_catalogue values(1,'Bad','Other',null,now())")).rejects.toThrow();
  await expect(role('authenticated','select public.claim_item_catalogue_refresh(false)')).rejects.toThrow();
  await expect(role('authenticated','select refresh_token from public.torn_item_catalogue_state')).rejects.toThrow();
 });
 it('grants only one import lease and stores the entire catalogue atomically',async()=>{
  token=(await role('service_role','select public.claim_item_catalogue_refresh(false) as token')).rows[0].token;expect(token).toBeTruthy();
  expect((await role('service_role','select public.claim_item_catalogue_refresh(false) as token')).rows[0].token).toBeNull();
  const saved=(await role('service_role','select public.save_torn_item_catalogue($1,$2) as data',[token,JSON.stringify(items)])).rows[0].data;
  expect(saved.item_count).toBe(1205);expect(saved.items).toHaveLength(1205);expect(saved.items[0]).toMatchObject({type:'Weapon',sub_type:'Secondary'});
  await expect(role('service_role','select public.save_torn_item_catalogue($1,$2)',[token,JSON.stringify(items)])).rejects.toThrow('lease expired');
 });
 it('keeps metadata forever and does not automatically acquire another upstream refresh',async()=>{
  expect((await role('service_role','select public.claim_item_catalogue_refresh(false) as token')).rows[0].token).toBeNull();
  expect((await role('service_role','select public.claim_item_catalogue_refresh(true) as token')).rows[0].token).toBeNull();
  await db.exec("update public.torn_item_catalogue_state set fetched_at=now()-interval '2 years'");
  expect((await role('service_role','select public.claim_item_catalogue_refresh(false) as token')).rows[0].token).toBeNull();
  expect((await role('authenticated','select public.get_torn_item_catalogue() as data')).rows[0].data.items).toHaveLength(1205);
 });
 it('preserves previous data if an explicit refresh contains invalid metadata',async()=>{
  token=(await role('service_role','select public.claim_item_catalogue_refresh(true) as token')).rows[0].token;
  await expect(role('service_role','select public.save_torn_item_catalogue($1,$2)',[token,JSON.stringify([{id:1,name:'',type:'Weapon'}])])).rejects.toThrow();
  expect((await role('authenticated','select public.get_torn_item_catalogue() as data')).rows[0].data.items[0].name).toBe('Test item 1');
  await role('service_role','select public.release_item_catalogue_refresh($1)',[token]);
 });
});

describe('trusted gateway catalogue capture',()=>{
 it('captures only All item reference data and excludes prices and personal records',async()=>{
  await db.exec('delete from public.torn_item_catalogue;update public.torn_item_catalogue_state set item_count=0,fetched_at=null,refresh_token=null,lease_until=null');
  await role('service_role','insert into public.torn_data_cache values($1,$2,$3)',['v2-user-inventory','{}',JSON.stringify({items})]);
  expect((await role('authenticated','select public.get_torn_item_catalogue() as data')).rows[0].data.item_count).toBe(0);
  await role('service_role','insert into public.torn_data_cache values($1,$2,$3)',['v2-torn-items','{"cat":"All"}',JSON.stringify({items:items.map(i=>({...i,value:{market_price:12345}}))})]);
  const saved=(await role('authenticated','select public.get_torn_item_catalogue() as data')).rows[0].data;
  expect(saved.item_count).toBe(1205);expect(saved.items[0]).toEqual({id:1,name:'Test item 1',type:'Weapon',sub_type:'Secondary'});expect(saved.items[0]).not.toHaveProperty('value');
 });
 it('reuses a permanent snapshot and ignores category-only or incomplete imports',async()=>{
  for(const params of ['{"cat":"Medical"}','{"cat":"All"}'])await role('service_role','insert into public.torn_data_cache values($1,$2,$3)',['v2-torn-items',params,JSON.stringify({items:[{id:1,name:'Changed',type:'Medical'}]})]);
  await db.exec("update public.torn_item_catalogue_state set fetched_at=now()-interval '2 days'");
  await role('service_role','insert into public.torn_data_cache values($1,$2,$3)',['v2-torn-items','{"cat":"All","timestamp":"1"}',JSON.stringify({items:[{id:1,name:'',type:'Medical'}]})]);
  expect((await role('authenticated','select public.get_torn_item_catalogue() as data')).rows[0].data.items[0].name).toBe('Test item 1');
 });
});
