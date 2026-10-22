export interface CatalogueItem { id:number;name:string;type:string;sub_type:string|null }
/** Parse official v2 arrays or the legacy v1 keyed item dictionary, without prices. */
export function parseItemCatalogue(payload:unknown):CatalogueItem[]{
 if(!payload||typeof payload!=='object'||!('items' in payload))throw new Error('Torn did not return an item catalogue.');
 const items=(payload as {items:unknown}).items;
 if(!items||typeof items!=='object')throw new Error('Torn did not return an item catalogue.');
 const entries:Array<[string,unknown]>=Array.isArray(items)?items.map((item,index)=>[String(index),item]):Object.entries(items);
 if(!entries.length)throw new Error('Torn returned an empty item catalogue. Your existing choices were kept.');
 const unique=new Map<number,CatalogueItem>();
 for(const [key,value] of entries){
  if(!value||typeof value!=='object')throw new Error('Torn returned an invalid item record. Your existing choices were kept.');
  const item=value as Record<string,unknown>,id=Array.isArray(items)?item.id:item.id??Number(key);
  if(typeof id!=='number'||!Number.isSafeInteger(id)||id<1||typeof item.name!=='string'||!item.name.trim())throw new Error('Torn returned an item without a valid name or ID. Your existing choices were kept.');
  if(item.sub_type!==undefined&&item.sub_type!==null&&typeof item.sub_type!=='string')throw new Error('Torn returned an invalid item type. Existing choices were kept.');
  const parsed={id,name:item.name.trim(),type:typeof item.type==='string'&&item.type.trim()?item.type.trim():'Uncategorized',sub_type:typeof item.sub_type==='string'&&item.sub_type.trim()?item.sub_type.trim():null};
  const previous=unique.get(id);if(previous&&(previous.name!==parsed.name||previous.type!==parsed.type||previous.sub_type!==parsed.sub_type))throw new Error('Torn returned conflicting records for the same item ID. Your existing choices were kept.');
  unique.set(id,parsed);
 }
 return [...unique.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.id-b.id);
}
