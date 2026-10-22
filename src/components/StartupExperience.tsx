import { useCallback,useEffect,useRef,useState,type ReactNode } from 'react';
import { startGalaxyFlight } from '../lib/galaxy-flight';
export const INTRO_EVENT='torn:replay-intro';
const motionQuery='(prefers-reduced-motion: reduce)';
function motionAllowed(){try{return localStorage.getItem('tcc-motion')!=='reduced'&&!window.matchMedia(motionQuery).matches;}catch{return false;}}
function firstVisit(){try{return !sessionStorage.getItem('tcc-galaxy-seen');}catch{return true;}}
export default function StartupExperience({ready,children}:{ready:boolean;children:ReactNode}){
 const [visible,setVisible]=useState(()=>motionAllowed()&&firstVisit()),[leaving,setLeaving]=useState(false);
 const canvas=useRef<HTMLCanvasElement>(null),content=useRef<HTMLDivElement>(null),skip=useRef<HTMLButtonElement>(null),closeTimer=useRef<ReturnType<typeof setTimeout>>();
 const dismiss=useCallback((immediate=false)=>{
  try{sessionStorage.setItem('tcc-galaxy-seen','1');}catch{}
  if(immediate){setVisible(false);setLeaving(false);return;}
  setLeaving(true);clearTimeout(closeTimer.current);closeTimer.current=setTimeout(()=>{setVisible(false);setLeaving(false);},550);
 },[]);
 useEffect(()=>{
  const replay=()=>{if(!motionAllowed())return;clearTimeout(closeTimer.current);setLeaving(false);setVisible(true);};
  const media=typeof window.matchMedia==='function'?window.matchMedia(motionQuery):null,reduce=()=>{if(!motionAllowed())dismiss(true);};
  window.addEventListener(INTRO_EVENT,replay);window.addEventListener('torn:motion-change',reduce);media?.addEventListener('change',reduce);
  return()=>{window.removeEventListener(INTRO_EVENT,replay);window.removeEventListener('torn:motion-change',reduce);media?.removeEventListener('change',reduce);clearTimeout(closeTimer.current);};
 },[dismiss]);
 useEffect(()=>{
  if(!visible)return;
  const previous=document.activeElement as HTMLElement|null,bodyOverflow=document.body.style.overflow;
  content.current?.setAttribute('inert','');document.body.style.overflow='hidden';skip.current?.focus();
  const keyboard=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();dismiss(true);}if(event.key==='Tab'){event.preventDefault();skip.current?.focus();}};
  document.addEventListener('keydown',keyboard);
  // Safety timeout also dismisses if canvas is unavailable or the scene fails.
  const timeout=setTimeout(()=>dismiss(),4200);
  let stop=()=>{};
  try{if(canvas.current)stop=startGalaxyFlight(canvas.current,()=>dismiss());}catch{/* The regular workspace remains usable. */}
  return()=>{stop();clearTimeout(timeout);document.removeEventListener('keydown',keyboard);content.current?.removeAttribute('inert');document.body.style.overflow=bodyOverflow;if(previous?.isConnected)previous.focus();};
 },[visible,dismiss]);
 return <><div ref={content} className={`application-surface ${visible?'intro-running':'intro-finished'}`}>{children}</div>{visible&&<section className={`galaxy-intro ${leaving?'galaxy-intro-leaving':''}`} role="dialog" aria-modal="true" aria-labelledby="galaxy-title" aria-describedby="galaxy-description">
  <canvas ref={canvas} className="galaxy-canvas" aria-hidden="true"/>
  <div className="galaxy-vignette" aria-hidden="true"/>
  <div className="galaxy-wordmark"><span className="galaxy-mark" aria-hidden="true">T<span>.</span></span><span>TORN HELPER<small>YOUR PERSONAL COMMAND CENTER</small></span></div>
  <button ref={skip} type="button" className="galaxy-skip" onClick={()=>dismiss(true)}>Skip intro <span aria-hidden="true">↗</span></button>
  <div className="galaxy-copy"><p className="galaxy-eyebrow"><span/>A LITTLE PERSPECTIVE. A BIGGER PICTURE.</p><h1 id="galaxy-title">Welcome to<br/><em>Torn Helper</em></h1><p id="galaxy-description">All your Torn tools. One universe.</p><div className="galaxy-status" role="status"><span className="galaxy-status-line" aria-hidden="true"/>{ready?'Your workspace is ready':'Opening your workspace…'}</div></div>
  <span className="galaxy-coordinate" aria-hidden="true">T / WORKSPACE · EST. 2026</span>
 </section>}</>;
}
