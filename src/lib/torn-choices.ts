import { CAPABILITIES } from '../api/capabilities';
export type Choice = { value:string; label:string };
export type CachedChoiceRow = { endpoint_id:string; payload:unknown };
const object=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{};
export function catalogueChoices(rows:CachedChoiceRow[], path:string, key:string, byName=false):Choice[] {
  const id=CAPABILITIES.find(c=>c.path===path)?.id;
  const values=rows.filter(r=>r.endpoint_id===id).flatMap(row=>{const value=key.split('.').reduce((v,k)=>object(v)[k],object(row.payload) as any);return Array.isArray(value)?value:[];});
  const unique=new Map<string,Choice>();
  for(const row of values){const r=object(row);if((typeof r.id!=='number'&&typeof r.id!=='string'))continue;if(byName&&!r.name)continue;const name=r.name??r.title??r.id;const value=String(byName?name:r.id);if(!unique.has(value))unique.set(value,{value,label:byName?String(name):`${name} [${r.id}]`});}
  return [...unique.values()].sort((a,b)=>a.label.localeCompare(b.label));
}
export function parameterChoices(rows:CachedChoiceRow[], path:string, parameter:string):Choice[] {
  if(parameter==='crimeId')return catalogueChoices(rows,'/torn/crimes','crimes');
  if(parameter==='trackId')return catalogueChoices(rows,'/racing/tracks','tracks');
  if(parameter==='stockId')return catalogueChoices(rows,'/torn/stocks','stocks');
  if(parameter==='propertyTypeId')return catalogueChoices(rows,'/torn/properties','properties');
  if(parameter==='raceId')return catalogueChoices(rows,'/user/races','races');
  if(parameter==='id'||parameter==='ids'){
    if(path.includes('item')||path.includes('bazaar')||path.includes('auction'))return catalogueChoices(rows,'/torn/items','items');
    if(path.includes('honors'))return catalogueChoices(rows,'/torn/honors','honors');
    if(path.includes('medals'))return catalogueChoices(rows,'/torn/medals','medals');
    if(path.startsWith('/user/'))return catalogueChoices(rows,'/faction/members','members');
    if(path.startsWith('/property/'))return catalogueChoices(rows,'/user/properties','properties');
  }
  return[];
}
