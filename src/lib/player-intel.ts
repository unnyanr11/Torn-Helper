import { CAPABILITIES } from '../api/capabilities';
import type { TornObservation } from './personal-data';
import { object } from './connected-data';
export const PLAYER_PROFILE_ENDPOINT=CAPABILITIES.find(c=>c.path==='/user/{id}/profile')!.id;
export function playerId(value:string){
 const input=value.trim(),id=Number(input);
 if(!/^[1-9]\d*$/.test(input)||!Number.isSafeInteger(id))throw new Error('Choose a player or enter a valid positive Torn player ID.');
 return id;
}
export async function lookupPlayerProfile(value:string,apiKey:string|undefined,signal:AbortSignal,fetch:(body:{endpoint_id:string;parameters:Record<string,string>;apiKey?:string},signal:AbortSignal)=>Promise<TornObservation>){
 const id=playerId(value);
 if(signal.aborted)throw new DOMException('Cancelled','AbortError');
 if(apiKey!==undefined&&!/^[A-Za-z0-9]{16}$/.test(apiKey))throw new Error('Enter a valid 16-character Torn API key for this lookup.');
 const observation=await fetch({endpoint_id:PLAYER_PROFILE_ENDPOINT,parameters:{id:String(id)},...(apiKey===undefined?{}:{apiKey})},signal);
 if(signal.aborted)throw new DOMException('Cancelled','AbortError');
 const profile=object(object(observation.payload).profile);
 if(observation.endpoint_id!==PLAYER_PROFILE_ENDPOINT||profile.id!==id||typeof profile.name!=='string')throw new Error('Torn did not return the requested player profile.');
 return observation;
}
/** Preserve the existing owner-scoped public-profile history; never infer private stats. */
export function profileHistory(owner:string,observation:TornObservation){
 const profile=object(object(observation.payload).profile);
 return {user_id:owner,torn_player_id:profile.id,status:object(profile.status).state??null,level:profile.level??null,last_action:object(profile.last_action).status??null,observed_at:observation.fetched_at};
}
