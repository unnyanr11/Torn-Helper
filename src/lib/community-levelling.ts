import type {CatalogueTarget,StarterTarget} from '../data/levelling-targets';
export const COMMUNITY_LIST='Community submissions';
export interface CommunityTargetRow {torn_id:number;player_name:string;level:number;last_action_at:string;verified_at:string}
export function mergeCommunityTargets(base:StarterTarget[],rows:CommunityTargetRow[]):CatalogueTarget[]{
 const merged=new Map<number,CatalogueTarget>(base.map(t=>[t.id,{...t,lists:[...(t.lists??[])]}]));
 for(const row of rows){
  const id=Number(row.torn_id),lastAction=Date.parse(row.last_action_at)/1000,verified=Date.parse(row.verified_at);
  if(!Number.isSafeInteger(id)||id<1||!Number.isInteger(row.level)||row.level<1||row.level>100||typeof row.player_name!=='string'||!Number.isFinite(lastAction)||!Number.isFinite(verified))continue;
  const old=merged.get(id);
  merged.set(id,{...(old??{id,reportedTotal:null}),name:row.player_name,reportedLevel:row.level,lists:[...new Set([...(old?.lists??[]),COMMUNITY_LIST])],lastAction,verifiedAt:row.verified_at});
 }
 return [...merged.values()];
}
