import { CAPABILITIES } from '../api/capabilities';
import { entryPayload,type DataEntry } from './connected-data';
import { observationKey } from './personal-data';
export const ESSENTIAL_PATHS=['/user/profile','/user/bars','/user/cooldowns','/user/travel'];
export function homeEntry(entries:Record<string,DataEntry>,path:string){
 const endpoint=CAPABILITIES.find(c=>c.path===path);return endpoint?entries[observationKey(endpoint.id,{})]:undefined;
}
export function observationAge(fetched:string|undefined,now:number){const time=Date.parse(fetched??'');return Number.isFinite(time)&&time<=now?Math.floor((now-time)/1000):null;}
export function freshnessLabel(fetched:string|undefined,now:number){const age=observationAge(fetched,now);if(age===null)return 'Collection time unavailable';if(age<60)return 'Checked less than a minute ago';if(age<3600)return `Snapshot · ${Math.floor(age/60)} minutes ago`;return `Snapshot · ${Math.floor(age/3600)} hours ago`;}
export function durationLabel(seconds:number){const n=Math.max(0,Math.ceil(seconds));if(n<60)return `${n}s`;if(n<3600)return `${Math.floor(n/60)}m ${n%60}s`;return `${Math.floor(n/3600)}h ${Math.floor(n%3600/60)}m`;}
export function remainingAtObservation(seconds:unknown,fetched:string|undefined,now:number){
 const age=observationAge(fetched,now);return typeof seconds==='number'&&Number.isFinite(seconds)&&seconds>=0&&age!==null?Math.max(0,seconds-age):null;
}
export function homeData(entries:Record<string,DataEntry>){
 return {bars:entryPayload(entries,'/user/bars').bars??{},cooldowns:entryPayload(entries,'/user/cooldowns').cooldowns??{},travel:entryPayload(entries,'/user/travel').travel??{}};
}
