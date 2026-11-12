import {describe,it,expect} from 'vitest';
import {INVENTORY_CATEGORIES,inventorySnapshot} from '../lib/inventory-data';
import {CONNECTED_REQUESTS,entryPayload} from '../lib/connected-data';
import {preparationPlan} from '../lib/account-preparation';
import {compileTornRequest} from '../../supabase/functions/_shared/torn-data';
import {mergeObservation} from '../lib/observation-cache';
import type {TornObservation} from '../lib/personal-data';
const row=(cat:string,ids:number[],at=1000,offset='0'):TornObservation=>({endpoint_id:'v2-user-inventory',parameters:{cat,limit:'250',offset},payload:{inventory:{items:ids.map(id=>({id,amount:1}))}},fetched_at:new Date(at).toISOString(),next_parameters:null});
describe('category-specific inventory collection',()=>{
 it('never issues the empty-category request rejected by Torn code 21',()=>{
  const rows=CONNECTED_REQUESTS.filter(r=>r.capability.path==='/user/inventory');
  expect(rows).toHaveLength(INVENTORY_CATEGORIES.length);expect(INVENTORY_CATEGORIES.length).toBe(25);
  for(const r of rows){expect(INVENTORY_CATEGORIES).toContain(r.parameters.cat);expect(r.parameters.limit).toBe('250');expect(()=>compileTornRequest(r.capability.id,r.parameters)).not.toThrow();expect(r.areas).toContain('Inventory');}
 });
 it('fits all inventory categories into the existing 95-section startup plan',()=>{
  const plan=preparationPlan();expect(plan).toHaveLength(95);expect(plan.filter(r=>r.capability.path==='/user/inventory')).toHaveLength(25);
 });
 it('merges category observations without counting old snapshots or later pages twice',()=>{
  let entries={};entries=mergeObservation(entries,row('Drug',[1]));entries=mergeObservation(entries,row('Medical',[2]));entries=mergeObservation(entries,row('Drug',[3],2000));entries=mergeObservation(entries,row('Drug',[9],3000,'250'));
  const result=inventorySnapshot(entries);expect(result.categories).toBe(2);expect(result.totalCategories).toBe(25);expect(result.payload.inventory.items.map(i=>i.id)).toEqual([3,2]);expect(entryPayload(entries,'/user/inventory').inventory.items).toHaveLength(2);
 });
 it('preserves incomplete-page information instead of calling a partial inventory complete',()=>{
  const observation={...row('Drug',[1]),next_parameters:{cat:'Drug',offset:'250'}};
  const result=inventorySnapshot(mergeObservation({},observation));expect(result.hasMore).toBe(true);expect(result.categories).toBe(1);
 });
});
