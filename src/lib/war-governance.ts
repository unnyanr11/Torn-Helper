import {supabase} from './supabase';
import {functionError} from './function-error';
import type {WarTarget} from './war-targets';
export type WarQueueEntry={id:number;user_id:string;target_id:number;player_name:string;attacks_goal:number;queued_at:string;expires_at:string;offer_until:string|null;resume_goal:boolean};
export type WarTargetRule={target_id:number;assignee_id:number;reason:string;updated_by:number};
export type WarTransfer={id:string;requester:string;holder:string;target_id:number;swap_target_id:number|null;expires_at:string};
export type WarGovernance={faction_id:number;war_key:string;actor_id:number;leader_id:number;is_leader:boolean;can_manage:boolean;max_attacks:number;members:{id:number;name:string}[];enemies:WarTarget[];handlers:{torn_id:number;appointed_by:number}[];rules:WarTargetRule[];queue:WarQueueEntry[];requests:WarTransfer[];notices:{body:string;created_at:string}[]};
export const governanceKey=(owner:string)=>['war-governance',owner];
export async function governanceAction(body:Record<string,unknown>):Promise<WarGovernance>{
 const result=await supabase.functions.invoke('war-governance',{body});
 if(result.error||result.data?.error)throw await functionError(result.data,result.error);
 return result.data;
}
