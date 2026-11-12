import {useEffect,useState} from 'react';
import {useAccountTimers} from './TimerProvider';
import {durationLabel,remainingAtObservation} from '../lib/home-dashboard';
import {sortWarTargets,type WarTargetList} from '../lib/war-targets';
export default function WarReadiness({list}:{list:WarTargetList|null}){
 const {baselines}=useAccountTimers(),[now,setNow]=useState(Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const bars=baselines.find(b=>b.endpoint_id==='v2-user-bars'),cooldowns=baselines.find(b=>b.endpoint_id==='v2-user-cooldowns'),profile=baselines.find(b=>b.endpoint_id==='v2-user-profile');
 const energy=bars?.payload?.bars?.energy,status=profile?.payload?.profile?.status??profile?.payload?.status;
 const medical=remainingAtObservation(cooldowns?.payload?.cooldowns?.medical,cooldowns?.observed_at,now);
 const hospital=status?.state==='Hospital'&&typeof status.until==='number'?Math.max(0,status.until-now/1000):null;
 const next=list?.active?sortWarTargets(list.targets.filter(t=>list.target_ids.includes(t.id)),list.priorities,now)[0]:null;
 return <article className="card"><h3>War readiness</h3><div className="war-readiness-grid"><p><strong>Energy</strong><br/>{energy?`${energy.current} / ${energy.maximum}`:'Load dashboard essentials first'}</p><p><strong>Medical cooldown</strong><br/>{medical===null?'Not yet loaded':durationLabel(medical)}</p><p><strong>My status</strong><br/>{status?.state??'Not yet loaded'}{hospital!==null?` · ${durationLabel(hospital)}`:''}</p><p><strong>Next assigned target</strong><br/>{next?.name??'No target selected'}</p></div><small>Uses saved dashboard snapshots. Timers run locally; no extra API calls. Energy is the last observed amount.</small></article>;
}
