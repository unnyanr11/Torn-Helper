import {STOCKS} from '../data/stocks';
import type {CachedChoiceRow,Choice} from './torn-choices';
export type StockReference={id:number;name:string;acronym:string};
const clean=(value:unknown)=>typeof value==='string'?value.replace(/<[^>]*>/g,' ').trim():'';
const normalized=(value:unknown)=>String(value??'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function stockCatalogue(rows:readonly CachedChoiceRow[]=[]):StockReference[]{
 const stocks=new Map<number,StockReference>(STOCKS.map(s=>[s.id,{...s}]));
 const observed=rows.filter(r=>r.endpoint_id==='v2-torn-stocks').slice().sort((a,b)=>(Date.parse(a.fetched_at??'')||0)-(Date.parse(b.fetched_at??'')||0));
 for(const row of observed){
  const value=(row.payload as any)?.stocks;
  const entries=Array.isArray(value)?value:value&&typeof value==='object'?Object.entries(value).map(([id,v])=>({...v as object,id:(v as any)?.id??id})):[];
  for(const entry of entries){
   const id=Number(entry?.id),name=clean(entry?.name);if(!Number.isSafeInteger(id)||id<=0||!name)continue;
   stocks.set(id,{id,name,acronym:clean(entry.acronym)||stocks.get(id)?.acronym||''});
  }
 }
 return [...stocks.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
export function findStock(value:unknown,rows:readonly CachedChoiceRow[]=[]):StockReference|undefined{
 const key=normalized(value);if(!key)return undefined;
 return stockCatalogue(rows).find(s=>String(s.id)===String(value).trim()||normalized(s.acronym)===key||normalized(s.name)===key);
}
export function stockLabel(value:unknown,rows:readonly CachedChoiceRow[]=[]):string{
 const stock=findStock(value,rows);return stock?`${stock.name}${stock.acronym?` (${stock.acronym})`:''}`:String(value??'');
}
export function stockChoices(rows:readonly CachedChoiceRow[]=[]):Choice[]{
 return stockCatalogue(rows).map(s=>({value:String(s.id),label:`${s.name}${s.acronym?` (${s.acronym})`:''} [${s.id}]`}));
}
