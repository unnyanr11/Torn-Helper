import {LoginError} from './torn-login.ts';
export const MINIMUM_INACTIVE_SECONDS=10*24*60*60;
export async function submissionRequest(req:Request){
 const reader=req.body?.getReader();if(!reader)throw new LoginError(400,'Enter a Torn player ID.');
 let size=0;const parts:Uint8Array[]=[];
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1024){await reader.cancel();throw new LoginError(413,'Submission is too large.');}parts.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
 let body:any;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new LoginError(400,'Invalid submission.');}
 if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['player_id','apiKey'].includes(k))||!Number.isSafeInteger(body.player_id)||body.player_id<1)throw new LoginError(400,'Enter a valid Torn player ID.');
 if(body.apiKey!==undefined&&(typeof body.apiKey!=='string'||!/^[A-Za-z0-9]{16}$/.test(body.apiKey)))throw new LoginError(400,'Enter a valid Torn API key.');
 return {player_id:body.player_id as number,apiKey:body.apiKey as string|undefined};
}
export function verifiedCommunityProfile(playerId:number,payload:any,now=Date.now()){
 const p=payload?.profile,last=p?.last_action?.timestamp;
 if(p?.id!==playerId||typeof p.name!=='string'||!p.name.trim()||p.name.length>100||!Number.isInteger(p.level)||p.level<1||p.level>100)throw new LoginError(502,'Torn did not return the requested player profile.');
 if(!Number.isSafeInteger(last)||last<=0||last>Math.floor(now/1000)-MINIMUM_INACTIVE_SECONDS)throw new LoginError(422,'This player cannot be added: their official last action must be at least 10 days ago. Missing or private last-action timestamps are not eligible.');
 return {id:playerId,name:p.name.trim(),level:p.level,lastAction:last as number};
}
