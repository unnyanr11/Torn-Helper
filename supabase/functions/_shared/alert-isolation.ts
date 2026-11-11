export function alertHour(timezone:unknown,now=new Date()){
 let zone=typeof timezone==='string'?timezone:'UTC';
 try{return Number(new Intl.DateTimeFormat('en-GB',{hour:'2-digit',hour12:false,timeZone:zone}).format(now))%24;}
 catch{return Number(new Intl.DateTimeFormat('en-GB',{hour:'2-digit',hour12:false,timeZone:'UTC'}).format(now))%24;}
}
export function quietHour(value:unknown):number|null{
 const match=/^(\d{1,2})(?::[0-5]\d)?$/.exec(String(value??''));
 return match&&Number(match[1])<24?Number(match[1]):null;
}
export async function isolatedAlertRules<T>(rules:T[],evaluate:(rule:T)=>Promise<void>,mark:(rule:T)=>Promise<void>){
 let failed=0;
 for(const rule of rules){try{await evaluate(rule);}catch{failed++;}finally{try{await mark(rule);}catch{failed++;}}}
 return failed;
}
