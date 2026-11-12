import {useEffect,useState} from 'react';
import {useAccountTimers} from './TimerProvider';
import {durationLabel} from '../lib/home-dashboard';
import {pageDatasets} from '../lib/account-preparation';
const labels:Record<string,string>={drug:'Drug cooldown',medical:'Medical cooldown',booster:'Booster cooldown',travel:'Travel arrival',arrival:'Travel arrival',education:'Course completion',education_remaining:'Course completion',organized_crime:'Organized crime ready',status:'Hospital / jail status',chain:'Chain timeout',energy_full:'Energy refill',nerve_full:'Nerve refill',happy_full:'Happiness refill',life_full:'Life refill'};
export default function TimerPanel({page='Overview'}:{page?:string}){
 const {baselines,status,error}=useAccountTimers(),[now,setNow]=useState(Date.now);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const ids=page==='Overview'?null:new Set(pageDatasets(page).map(row=>row.id));
 const rows=baselines.filter(row=>!ids||ids.has(row.endpoint_id)).flatMap(row=>Object.entries(row.deadlines).filter(([name])=>!(name==='arrival'&&row.deadlines.travel!=null)&&!(name==='education_remaining'&&row.deadlines.education!=null)).map(([name,ends])=>({id:row.endpoint_id+name,label:labels[name]??name,end:ends,at:row.observed_at})));
 if(!rows.length&&!error)return null;
 return <section className="card" aria-label="Saved countdowns"><h3>Saved countdowns</h3><p>Timers run from saved deadlines. These clock ticks make no API calls.</p>
  <dl className="data-metrics">{rows.map(row=><div key={row.id}><dt>{row.label}</dt><dd title={`Baseline ${new Date(row.at).toLocaleString()}`}>{row.end*1000>now?durationLabel((row.end*1000-now)/1000):'Elapsed · estimated'}<small> {new Date(row.end*1000).toLocaleTimeString()}</small></dd></div>)}</dl>
  {status&&<p className="muted">{status.checked_through?`Logs checked through ${new Date(status.checked_through*1000).toLocaleTimeString()}. `:''}{status.message??(status.status==='catching_up'?'Catching up on activity logs.':'Backend watches new logs and rechecks affected timers.')} Actions absent from available logs may require a manual refresh.</p>}
  {error&&<p role="status">Backend timer updates could not be loaded. Saved countdowns still run; their accuracy is unconfirmed.</p>}
 </section>;
}
