import type { TornObservation } from './personal-data';
export type EnergyLogCoverage={baseline:string;from:number;to:number;complete:boolean;pages:number};
/** Fetch at most two log pages; a fresh bar is cheaper than a long historical replay. */
export async function syncEnergyLogs(options:{baseline:string;since?:number;signal:AbortSignal;fetch:(parameters:Record<string,string>)=>Promise<TornObservation>;pause:(ms:number,signal:AbortSignal)=>Promise<void>;onPage:(observation:TornObservation)=>void;now?:number}):Promise<EnergyLogCoverage>{
 const base=Math.floor(Date.parse(options.baseline)/1000),to=Math.floor((options.now??Date.now())/1000);
 if(!Number.isSafeInteger(base)||base<=0||base>to||to-base>86400)throw new Error('Refresh energy before collecting logs; the baseline is missing or too old.');
 const from=options.since!==undefined&&Number.isSafeInteger(options.since)&&options.since<=to?Math.max(base,options.since-1):base;
 let parameters:Record<string,string>|null={from:String(from),to:String(to),limit:'100'},pages=0;const seen=new Set<string>();
 while(parameters&&pages<2){
  if(options.signal.aborted)throw new DOMException('Cancelled','AbortError');
  const signature=JSON.stringify(Object.entries(parameters).sort());if(seen.has(signature))throw new Error('Log pagination repeated. Refresh energy to confirm.');seen.add(signature);
  const observation=await options.fetch(parameters);if(options.signal.aborted)throw new DOMException('Cancelled','AbortError');
  if(observation.endpoint_id!=='v2-user-log'||!Array.isArray((observation.payload as any)?.log))throw new Error('Torn did not return activity logs.');
  options.onPage(observation);pages++;
  parameters=observation.next_parameters?{...observation.next_parameters,from:String(from),limit:'100'}:null;
  if(parameters&&pages<2)await options.pause(3400,options.signal);
 }
 return {baseline:options.baseline,from,to,complete:parameters===null,pages};
}
