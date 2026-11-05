export type BattleJob={user_id:string;token:string};
export async function runBattleJob(job:BattleJob,deps:{act:(action:string,parameters?:Record<string,string>,failure?:string)=>Promise<any>;load:(endpoint:string,parameters?:Record<string,string>,fresh?:boolean)=>Promise<void>}){
 try{
  if((await deps.act('check')).skipped)return 'skipped';
  await deps.load('v2-user-faction');
  const plan=await deps.act('prepare');if(plan.skipped)return 'skipped';
  if(plan.needs_baseline){await deps.load('v2-user-battlestats',{},true);const reset=await deps.act('baseline');if(reset.skipped)return 'skipped';}
  else if(plan.parameters){
   await deps.load('v2-user-log',plan.parameters);
   const applied=await deps.act('apply',plan.parameters);if(applied.skipped)return 'skipped';
   if(applied.needs_baseline){await deps.load('v2-user-battlestats',{},true);const reset=await deps.act('baseline');if(reset.skipped)return 'skipped';}
  }
  await deps.act('finish');return 'updated';
 }catch{
  // Never store upstream messages, raw logs, keys or decrypted credentials in job status.
  try{await deps.act('finish',{},'Automatic update paused. Check the saved Torn key has Full Access and logs enabled; the next retry is backed off.');}catch{/* A withdrawn share or expired lease must not be recreated. */}return 'paused';
 }
}
