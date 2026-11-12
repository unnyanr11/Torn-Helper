export type WarOpponent={key:string;kind:string;id:number;name:string;war_id:number};
export type WarTarget={id:number;name:string;level:number;state:string;hospital_until:number|null};
export const positiveId=(value:unknown):value is number=>Number.isSafeInteger(value)&&Number(value)>0;
/** Official /faction/wars: scheduled, ended, unrelated and malformed wars fail closed. */
export function activeOpponents(payload:any,factionId:number,now=Date.now()):WarOpponent[]{
 if(!payload?.wars||!('ranked' in payload.wars)||!Array.isArray(payload.wars.raids)||!Array.isArray(payload.wars.territory))throw new Error('Torn did not return current faction wars.');
 const result:WarOpponent[]=[];
 for(const [kind,rows] of [['ranked',[payload.wars.ranked]],['raid',payload.wars.raids],['territory',payload.wars.territory]] as const){
  for(const row of rows){
   if(!row||!positiveId(row.war_id)||!Number.isSafeInteger(row.start)||row.start*1000>now||!(row.end===null||row.end===0)||!Array.isArray(row.factions)||!row.factions.some((f:any)=>f.id===factionId))continue;
   for(const enemy of row.factions)if(positiveId(enemy.id)&&enemy.id!==factionId)result.push({key:`${kind}:${row.war_id}:${enemy.id}`,kind,id:enemy.id,name:String(enemy.name).slice(0,100),war_id:row.war_id});
  }
 }
 return result;
}
export function rosterTargets(payload:any):WarTarget[]{
 if(!Array.isArray(payload?.members)||payload.members.length>200)throw new Error('A complete faction roster is required.');
 return payload.members.filter((m:any)=>positiveId(m.id)).map((m:any)=>({id:m.id,name:String(m.name??m.id).slice(0,100),level:Number.isInteger(m.level)?m.level:0,state:String(m.status?.state??'Unknown').slice(0,40),hospital_until:m.status?.state==='Hospital'&&positiveId(m.status?.until)?m.status.until:null}));
}
export function validateSelection(ids:unknown,roster:WarTarget[]):number[]{
 if(!Array.isArray(ids)||ids.length>100||ids.some(id=>!positiveId(id))||new Set(ids).size!==ids.length)throw new Error('Choose up to 100 unique targets.');
 if(ids.some(id=>!roster.some(m=>m.id===id)))throw new Error('Targets must belong to the active enemy faction.');
 return ids;
}
export function authorizeAssignee(actorId:number,assigneeId:number,leaderId:number,roster:WarTarget[]){
 if(!positiveId(assigneeId))throw new Error('Choose a faction member.');
 if(assigneeId!==actorId&&(actorId!==leaderId||!roster.some(m=>m.id===actorId)||!roster.some(m=>m.id===assigneeId)))throw new Error('Only the current faction leader can change another current member’s targets.');
}
