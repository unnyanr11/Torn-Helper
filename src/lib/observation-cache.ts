import { observationKey,type TornObservation } from './personal-data';
import { homeEntry } from './home-dashboard';
import type { DataEntry } from './connected-data';
export const observationsKey=(owner:string)=>['torn-observations',owner] as const;
export function isRecent(observation:TornObservation|undefined,maxAge:number,now=Date.now()){
 const at=Date.parse(observation?.fetched_at??'');return Number.isFinite(at)&&at<=now&&now-at<maxAge;
}
/** Keep actual timestamps and a bounded, private in-memory view; never store keys. */
export function mergeObservation(entries:Record<string,DataEntry>,observation:TornObservation,restored=false){
 const id=observationKey(observation.endpoint_id,observation.parameters),previous=entries[id];
 if(previous?.observation&&Date.parse(previous.observation.fetched_at)>Date.parse(observation.fetched_at))return entries;
 const next={...entries,[id]:{observation,restored,previous:previous?.observation?.fetched_at===observation.fetched_at?previous.previous:previous?.observation?.payload}};
 return Object.fromEntries(Object.entries(next).sort(([,a],[,b])=>Date.parse(b.observation?.fetched_at??'')-Date.parse(a.observation?.fetched_at??'')).slice(0,100));
}
export type UpdateMode='off'|'economy'|'active';
export const UPDATE_PATHS=['/user/bars','/user/cooldowns','/user/travel','/user/profile'];
export function refreshAfter(path:string,mode:UpdateMode,payload?:unknown){
 if(mode==='off')return Infinity;
 if(path==='/user/profile')return 900000;
 const flight=(payload as any)?.travel?.time_left;
 return mode==='active'&&(path!=='/user/travel'||typeof flight==='number'&&flight>0)?60000:300000;
}

export function nextRefreshPath(entries:Record<string,DataEntry>,mode:UpdateMode,visible:boolean,online:boolean,now=Date.now()){
 if(mode==='off'||!visible||!online)return undefined;
 return UPDATE_PATHS.map(path=>({path,observation:homeEntry(entries,path)?.observation})).filter(row=>!isRecent(row.observation,refreshAfter(row.path,mode,row.observation?.payload),now)).sort((a,b)=>(Date.parse(a.observation?.fetched_at??'')||0)-(Date.parse(b.observation?.fetched_at??'')||0))[0]?.path;
}
