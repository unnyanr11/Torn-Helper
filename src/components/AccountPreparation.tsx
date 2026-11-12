import {useEffect,useRef,useState,type ReactNode} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {supabase} from '../lib/supabase';
import {invokeTornData} from '../lib/torn-data-client';
import {functionError} from '../lib/function-error';
import {useSavedObservations} from '../hooks/useSavedObservations';
import {emptyProgress,PREPARATION_CALLS,PREPARATION_MS,startPreparation,type PreparationResult} from '../lib/account-preparation';
import {observationKey} from '../lib/personal-data';
import {observationsKey} from '../lib/observation-cache';
import type {DataEntry} from '../lib/connected-data';
import './account-preparation.css';
export const preparationKey=(owner:string)=>['account-preparation',owner] as const;
const messages=['Preparing environment','Loading dashboard essentials','Restoring saved timers','Checking cooldown deadlines','Preparing travel status','Connecting your workspace'];
export default function AccountPreparation({owner,children}:{owner:string;children:ReactNode}){
 if(!owner)return <>{children}</>;
 return <PrivatePreparation key={owner} owner={owner}>{children}</PrivatePreparation>;
}
function PrivatePreparation({owner,children}:{owner:string;children:ReactNode}){
 const client=useQueryClient();
 // Restore saved observations alongside collection so a restore never replaces new data.
 useSavedObservations(owner);
 const [progress,setProgress]=useState(emptyProgress),[remaining,setRemaining]=useState(60),[phrase,setPhrase]=useState(messages[0]),[phase,setPhase]=useState<'loading'|'ready'|'done'>(()=>client.getQueryData(preparationKey(owner))?'done':'loading');
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{
  if(client.getQueryData(preparationKey(owner)))return;
  let cleanup:(()=>void)|undefined,disposed=false;
  const boot=setTimeout(()=>{
   if(disposed)return;
   heading.current?.focus();
   const task=startPreparation({
    fetch:async(row,signal)=>{
     const response=await invokeTornData(client,{body:{endpoint_id:row.capability.id,parameters:row.parameters,refresh:false},signal});
     if(signal.aborted)throw new DOMException('Cancelled','AbortError');
     if(!response.error&&!response.data?.error)return {ok:true};
     const problem=(await functionError(response.data,response.error)).message;
     client.setQueryData<Record<string,DataEntry>>(observationsKey(owner),old=>{const id=observationKey(row.capability.id,row.parameters);return {...old,[id]:{...old?.[id],error:problem}};});
     const status=response.error?.context?.status;
     return {ok:false,error:problem,kind:status===403?'restricted' as const:'failed' as const,fatal:[401,409,429].includes(status??0)||/no key|retained|decrypt|tracking is paused|sign.?in|rate.?limit|request limit|code (2|5|10|13)\b/i.test(problem)};
    },
    onProgress:value=>{if(!disposed)setProgress(value);},
    onComplete:(result:PreparationResult)=>{
     if(disposed)return;
     client.setQueryData(preparationKey(owner),result);
     setProgress(result);setRemaining(0);setPhase('ready');
     clearInterval(clock);clearInterval(text);
     ready=setTimeout(()=>{if(!disposed){setPhase('done');requestAnimationFrame(()=>document.getElementById('workspace-content')?.focus());}},1200);
    }
   });
   const clock=setInterval(()=>setRemaining(Math.max(0,Math.ceil((PREPARATION_MS-(Date.now()-task.startedAt))/1000))),100);
   const text=setInterval(()=>setPhrase(old=>{const other=messages.filter(value=>value!==old);return other[Math.floor(Math.random()*other.length)];}),3500);
   let ready:ReturnType<typeof setTimeout>|undefined;
   cleanup=()=>{task.cancel();clearInterval(clock);clearInterval(text);clearTimeout(ready);};
  },0);
  return()=>{disposed=true;clearTimeout(boot);cleanup?.();};
 },[client,owner]);
 if(phase==='done')return <>{children}</>;
 const complete=phase==='ready';
 return <main className={`account-preparation ${complete?'is-ready':''}`} aria-labelledby="preparation-title">
  <div className="preparation-glow" aria-hidden="true"/>
  <section className="preparation-panel">
   <p className="preparation-eyebrow">TORN HELPER · YOUR WORKSPACE</p>
   <div className="preparation-orbit" aria-hidden="true">{complete?<svg viewBox="0 0 64 64"><path d="M15 33l11 11 24-25"/></svg>:<><span/><span/><b>T.</b></>}</div>
   <h1 id="preparation-title" ref={heading} tabIndex={-1}>{complete?"You’re ready now":"Getting your world ready"}</h1>
   <p className="preparation-message" role="status">{complete?(progress.loaded===PREPARATION_CALLS?'Your dashboard essentials are ready. Let’s go.':'Your workspace is ready. Available data has been saved.'):phrase+'…'}</p>
   <div className="preparation-timer" role="timer" aria-label="Preparation time remaining">{String(Math.floor(remaining/60)).padStart(2,'0')}:{String(remaining%60).padStart(2,'0')}</div>
   <progress aria-label="One-minute preparation" value={60-remaining} max={60}/>
   {!complete&&<p className="preparation-current">{progress.current}</p>}
   {progress.problem&&<p className="preparation-note" role="status">{progress.problem}{!complete&&' Your workspace will open when the timer finishes.'}</p>}
   {complete&&(progress.loaded<PREPARATION_CALLS)&&<p className="preparation-note">Some essentials could not be loaded. Check the details or retry them inside your workspace.</p>}
   {!complete&&<p className="preparation-note">A one-minute setup for your personal tools. Data access depends on your Torn key and role.</p>}
   {progress.issues.length>0&&<details className="preparation-note"><summary>See loading details</summary><ul>{progress.issues.map(issue=><li key={issue.endpoint+issue.label}><strong>{issue.label}</strong>: {issue.reason}</li>)}</ul></details>}
   <button type="button" className="preparation-signout" onClick={()=>void supabase.auth.signOut()}>Sign out</button>
  </section>
 </main>;
}
