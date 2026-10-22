import { CAPABILITIES } from '../api/capabilities';
import { catalogueChoices, type CachedChoiceRow, type Choice } from './torn-choices';
export type EntrySource = 'player'|'playerName'|'item'|'itemName'|'stock'|'faction'|'factionName'|'companyName'|'upgrade'|'territory'|'oc'|'track';
export const choicesFrom = (values:readonly (string|number)[]):Choice[] => [...new Set(values.map(String))].map(value=>({value,label:value}));
export function mergeChoices(...groups:Choice[][]):Choice[]{
 const unique=new Map<string,Choice>();for(const group of groups)for(const option of group)if(option.value&&!unique.has(option.value))unique.set(option.value,option);
 return [...unique.values()];
}
const obj=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{};
export function observedChoices(rows:CachedChoiceRow[],source:EntrySource,category='',itemType=''):Choice[]{
 if(source==='item'||source==='itemName'){
  if(!category&&!itemType)return catalogueChoices(rows,'/torn/items','items',source==='itemName');
  const filtered=rows.map(row=>({...row,payload:{...obj(row.payload),items:Array.isArray(obj(row.payload).items)?obj(row.payload).items.filter((i:any)=>(!category||i?.type===category)&&(!itemType||i?.sub_type===itemType)):[]}}));
  return catalogueChoices(filtered,'/torn/items','items',source==='itemName');
 }
 if(source==='stock')return catalogueChoices(rows,'/torn/stocks','stocks');
 if(source==='track')return catalogueChoices(rows,'/racing/tracks','tracks',true);
 const result:Choice[]=[];
 const add=(record:unknown,byName:boolean,idKey='id')=>{const r=obj(record),id=r[idKey],name=r.name;if(typeof name!=='string'||!name.trim())return;if(byName)result.push({value:name,label:name});else if((typeof id==='number'&&Number.isSafeInteger(id)&&id>0)||typeof id==='string'&&/^\d+$/.test(id))result.push({value:String(id),label:`${name} [${id}]`});};
 for(const row of rows){const p=obj(row.payload),path=CAPABILITIES.find(c=>c.id===row.endpoint_id)?.path??'';
  if(source==='player'||source==='playerName'){
   if(!path.startsWith('/user/')&&path!=='/faction/members'&&path!=='/company/{id}/employees'&&path!=='/company/employees')continue;
   add(p.profile,source==='playerName');
   for(const key of ['members','friends','enemies','targets','employees','list'])if(Array.isArray(p[key]))for(const r of p[key])add(r,source==='playerName');
   if(Array.isArray(p.attacks))for(const r of p.attacks){add(r?.attacker,source==='playerName');add(r?.defender,source==='playerName');}
  }else if(source==='faction'||source==='factionName'){if(!path.startsWith('/faction/')&&!path.startsWith('/user/'))continue;add(p.faction,source==='factionName');add(obj(p.profile).faction,source==='factionName');if(Array.isArray(p.factions))for(const r of p.factions)add(r,source==='factionName');}
  else if(source==='companyName'&&path.startsWith('/company/'))add(p.company,true);
  else if(source==='upgrade'){
   const upgrades=p.upgrades;if(Array.isArray(upgrades))for(const r of upgrades)add(r,true);
   else for(const r of Object.values(obj(upgrades)))add(r,true);
  }else if(source==='territory'){
   const territories=p.territory??p.territories;if(Array.isArray(territories))for(const r of territories){const name=typeof r==='string'?r:r?.name??r?.id;if(typeof name==='string')result.push({value:name,label:name});}
   else for(const key of Object.keys(obj(territories)))result.push({value:key,label:key});
  }else if(source==='oc'&&Array.isArray(p.crimes))for(const r of p.crimes)add(r,true);
 }
 return mergeChoices(result).sort((a,b)=>a.label.localeCompare(b.label));
}
export function itemCategories(rows:CachedChoiceRow[]):Choice[]{
 const types:string[]=[];for(const row of rows)if(CAPABILITIES.find(c=>c.id===row.endpoint_id)?.path==='/torn/items'&&Array.isArray(obj(row.payload).items))for(const item of obj(row.payload).items)if(typeof item?.type==='string')types.push(item.type);
 return choicesFrom(types.sort());
}

export function itemTypes(rows:CachedChoiceRow[],category=''):Choice[]{
 const types:string[]=[];for(const row of rows)if(CAPABILITIES.find(c=>c.id===row.endpoint_id)?.path==='/torn/items'&&Array.isArray(obj(row.payload).items))for(const item of obj(row.payload).items)if((!category||item?.type===category)&&typeof item?.sub_type==='string')types.push(item.sub_type);
 return choicesFrom(types.sort());
}
export type NumberKind='count'|'money'|'signedMoney'|'percent'|'level'|'minutes'|'seconds'|'days'|'months'|'energy'|'width'|'weight'|'decimal';
export function numberChoices(kind:NumberKind,min?:number|string,max?:number|string,step?:number|string):Choice[]{
 const series=(start:number,end:number)=>Array.from({length:end-start+1},(_,i)=>i+start);
 const presets:Record<NumberKind,number[]>={count:[...series(0,30),40,50,75,100,150,200,250,500,1000,2500,5000,10000],money:[0,100,500,1000,5000,10000,25000,50000,100000,250000,500000,1000000,5000000,10000000,100000000,1000000000],signedMoney:[-1000000,-100000,-10000,-1000,0,1000,10000,100000,1000000,10000000],percent:[0,0.5,1,2,2.5,3,5,7.5,10,12.5,15,20,25,30,50,75,100],level:series(1,100),minutes:[1,2,5,10,15,20,30,45,60,90,120,180,240,360,720,1440],seconds:[0,15,30,45,60,90,120,180,240,300,600,900,1800,3600],days:[0,1,2,3,5,7,10,14,21,30,60,90],months:[1,2,3,6,9,12,18,24,36,48,60,120,240,360,600],energy:[5,10,15,20,25,50,75,100,125,150,200,250,500,1000],width:[80,100,120,140,160,180,200,240,280,320,400,480,600],weight:[0,0.25,0.5,0.75,1,1.25,1.5,2,2.5,3,5,10],decimal:[0,0.1,0.5,1,2,5,10,25,50,100,1000]};
 const low=min===undefined?-Infinity:Number(min),high=max===undefined?Infinity:Number(max),increment=step===undefined||step==='any'?null:Number(step),base=min===undefined?0:Number(min);
 return presets[kind].filter(n=>n>=low&&n<=high&&(increment===null||!Number.isFinite(increment)||increment<=0||Math.abs((n-base)/increment-Math.round((n-base)/increment))<1e-7)).map(n=>({value:String(n),label:n.toLocaleString()}));
}
export function recordChoices(records:unknown[],idKey:string,nameKey:string,byName=false):Choice[]{
 const choices:Choice[]=[];
 for(const value of records){const r=obj(value),id=r[idKey],name=r[nameKey];
  if(byName){if(typeof name==='string'&&name.trim())choices.push({value:name,label:name});}
  else if(id!==null&&id!==undefined&&String(id).trim())choices.push({value:String(id),label:typeof name==='string'&&name.trim()?`${name} [${id}]`:String(id)});
 }
 return mergeChoices(choices);
}
