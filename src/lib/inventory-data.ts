import {CAPABILITIES} from '../api/capabilities';
import type {TornObservation} from './personal-data';
const schemaCategories=CAPABILITIES.find(c=>c.path==='/user/inventory')?.parameters.find(p=>p.name==='cat')?.schema.enum??[];
export const INVENTORY_CATEGORIES:string[]=[...new Set(['Drug','Medical',...schemaCategories])];
/** Combine the latest first page per category; never pretend missing pages are empty. */
export function inventorySnapshot(entries:Record<string,{observation?:TornObservation}>){
 const latest=new Map<string,TornObservation>();
 for(const entry of Object.values(entries)){
  const row=entry.observation,cat=row?.parameters.cat;
  if(row?.endpoint_id!=='v2-user-inventory'||!cat||!INVENTORY_CATEGORIES.includes(cat)||Number(row.parameters.offset??0)!==0||!Array.isArray((row.payload as any)?.inventory?.items))continue;
  if(!latest.has(cat)||Date.parse(row.fetched_at)>Date.parse(latest.get(cat)!.fetched_at))latest.set(cat,row);
 }
 const items:any[]=[];let hasMore=false;
 for(const row of latest.values()){
  const payload=row.payload as any;items.push(...payload.inventory.items);
  hasMore ||= !!row.next_parameters||typeof payload._metadata?.total==='number'&&payload._metadata.total>payload.inventory.items.length||!!payload._metadata?.links?.next;
 }
 return {payload:{inventory:{items}},categories:latest.size,totalCategories:INVENTORY_CATEGORIES.length,hasMore};
}
