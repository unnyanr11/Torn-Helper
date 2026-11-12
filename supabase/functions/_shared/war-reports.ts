export type WarAttack={id:string;attacker:number;defender:number;started:number;ended:number;result:string;respect:number};
export function attackRecords(payload:any,actor:number,from:number,to:number,enemy?:number,kind?:string,warId?:number):WarAttack[]{
 if(!Array.isArray(payload?.attacks))throw new Error('Torn did not return attack history.');
 return payload.attacks.filter((a:any)=>a.attacker?.id===actor&&Number.isSafeInteger(a.defender?.id)&&Number.isSafeInteger(a.started)&&Number.isSafeInteger(a.ended)&&a.started>=from&&a.ended>=from&&a.ended<=to&&!a.is_interrupted&&(!kind||kind==='ranked'&&a.is_ranked_war===true||kind==='raid'&&a.is_raid===true||kind==='territory'&&a.is_territory_war===true&&a.territory_war_id===warId)&&(!enemy||a.defender?.faction?.id===enemy)&&/^\d+$/.test(String(a.id))).map((a:any)=>({id:String(a.id),attacker:actor,defender:a.defender.id,started:a.started,ended:a.ended,result:String(a.result).slice(0,80),respect:Number.isFinite(a.respect_gain)?a.respect_gain:0}));
}
export function attackNext(payload:any,params:Record<string,string>):Record<string,string>|null{
 const raw=payload?._metadata?.links?.next;if(raw==null)return null;
 if(typeof raw!=='string')throw new Error('Attack history pagination could not be verified.');
 const url=new URL(raw,'https://api.torn.com');
 if(url.origin!=='https://api.torn.com'||url.pathname!=='/v2/user/attacks')throw new Error('Attack history pagination could not be verified.');
 const from=url.searchParams.get('from'),to=url.searchParams.get('to')??params.to;
 if(!from||!Number.isFinite(Number(from))||Number(from)<Number(params.from)||Number(from)>Number(params.to)||to!==params.to)throw new Error('Attack history range could not be verified.');
 const next={...params,from};
 if(next.from===params.from)throw new Error('Attack history page did not advance.');
 return next;
}
export function mergeWarAttacks(old:WarAttack[],next:WarAttack[]){return [...new Map([...old,...next].map(a=>[a.id,a])).values()].sort((a,b)=>a.ended-b.ended||a.id.localeCompare(b.id));}
