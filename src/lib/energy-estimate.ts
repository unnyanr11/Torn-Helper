import { CAPABILITIES } from '../api/capabilities';
import { object,type DataEntry } from './connected-data';
import { homeEntry } from './home-dashboard';
export type EnergyLedger={confirmed:number|null;maximum:number|null;baseline:number|null;value:number|null;at:number;nextTick:number|null;increment:number;interval:number;events:number;reason:string|null};
const integer=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n);
const stable=(value:unknown):string=>JSON.stringify(value&&typeof value==='object'?(Array.isArray(value)?value.map(v=>JSON.parse(stable(v))):Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,JSON.parse(stable(v))]))):value);
const energyRelated=/energy|gym|attack|hunting|reviv|overdose|donator|subscri/i;
/** Rebuilt only when observations change. Never infer a cost from notification prose. */
export function buildEnergyLedger(entries:Record<string,DataEntry>,now=Date.now()):EnergyLedger{
 const observation=homeEntry(entries,'/user/bars')?.observation,energy=object(object(observation?.payload).bars).energy;
 const baseline=Date.parse(observation?.fetched_at??'')/1000;
 const ledger:EnergyLedger={confirmed:integer(energy?.current)&&energy.current>=0?energy.current:null,maximum:integer(energy?.maximum)&&energy.maximum>0?energy.maximum:null,baseline:Number.isFinite(baseline)?baseline:null,value:null,at:baseline,nextTick:null,increment:energy?.increment,interval:energy?.interval,events:0,reason:null};
 const stop=(reason:string)=>({...ledger,value:null,reason});
 if(ledger.confirmed===null||ledger.maximum===null||ledger.baseline===null||baseline>now/1000)return stop('Refresh energy to establish a confirmed starting value.');
 if(!integer(energy.increment)||energy.increment<=0||!integer(energy.interval)||energy.interval<=0||energy.interval>86400||!integer(energy.tick_time)||energy.tick_time<=0||energy.tick_time>energy.interval)return stop('The last energy observation has no usable next-tick timing. Refresh energy to confirm.');
 ledger.value=ledger.confirmed;ledger.nextTick=baseline+energy.tick_time;
 const endpoint=CAPABILITIES.find(c=>c.path==='/user/log')!.id,seen=new Map<string,{id:string;timestamp:number;title:string;data:Record<string,any>}>();
 for(const entry of Object.values(entries))if(entry.observation?.endpoint_id===endpoint){
  const logs=object(entry.observation.payload).log;
  if(!Array.isArray(logs))continue;
  for(const raw of logs){const row=object(raw),timestamp=row.timestamp;
   if(!integer(timestamp)||timestamp<=Math.floor(baseline))continue;
   if(timestamp>now/1000)return stop('A log timestamp is ahead of this device clock. Refresh energy to confirm.');
   if(typeof row.id!=='string'||!row.id)return stop('A recent log has no stable ID. Refresh energy to confirm.');
   const event={id:row.id,timestamp,title:String(object(row.details).title??''),data:object(row.data)},previous=seen.get(event.id);
   if(previous&&stable(previous)!==stable(event))return stop('Conflicting copies of an activity log were found. Refresh energy to confirm.');
   seen.set(event.id,event);
  }
 }
 const events=[...seen.values()].sort((a,b)=>a.timestamp-b.timestamp||a.id.localeCompare(b.id));
 const simultaneous=new Map<number,number>();for(const event of events)if(['energy_used','energy_increased','energy_decreased'].some(key=>key in event.data))simultaneous.set(event.timestamp,(simultaneous.get(event.timestamp)??0)+1);
 for(const event of events){
  const data=event.data,fields=['energy_used','energy_increased','energy_decreased'],present=fields.filter(key=>key in data),other=Object.keys(data).filter(key=>/energy/i.test(key)&&!fields.includes(key));
  if(/regenerat|natural.*energy|energy.*tick/i.test(event.title))return stop('A regeneration-related log may change the timer rules. Refresh energy to confirm.');
  if(other.length||!present.length&&energyRelated.test(event.title))return stop('A recent energy-related event has no unambiguous energy change. Refresh energy to confirm.');
  if(!present.length)continue;
  if(present.some(key=>!integer(data[key])||data[key]<0))return stop('A log contains an unsupported energy amount. Refresh energy to confirm.');
  // API timestamps have second precision; ordering energy actions at one second is unknown.
  if((simultaneous.get(event.timestamp)??0)>1)return stop('Several energy changes share a timestamp. Refresh energy to confirm their order.');
  advance(ledger,event.timestamp);
  const delta=(data.energy_increased??0)-(data.energy_used??0)-(data.energy_decreased??0);
  if(ledger.value!+delta<0)return stop('Known energy costs exceed the estimate; logs may be missing. Refresh energy to confirm.');
  ledger.value!+=delta;ledger.at=event.timestamp;ledger.events++;
 }
 return ledger;
}
function advance(state:EnergyLedger,to:number){
 if(state.value===null||state.nextTick===null||state.maximum===null)return;
 if(to>=state.nextTick){const ticks=Math.floor((to-state.nextTick)/state.interval)+1;if(state.value<state.maximum)state.value=Math.min(state.maximum,state.value+ticks*state.increment);state.nextTick+=ticks*state.interval;}
 state.at=to;
}
/** O(1) local clock projection; no log replay or API request on each clock tick. */
export function projectEnergy(ledger:EnergyLedger,now=Date.now()){
 const state={...ledger};
 if(state.baseline!==null&&now/1000-state.baseline>86400)return {...state,value:null,reason:'The energy baseline is over 24 hours old. Refresh energy to confirm.'};
 if(now/1000<state.at)return {...state,value:null,reason:'This device clock moved backwards. Refresh energy to confirm.'};
 if(state.reason||state.value===null)return state;
 advance(state,now/1000);return state;
}
