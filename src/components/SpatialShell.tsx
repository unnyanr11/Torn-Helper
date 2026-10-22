import { useEffect,useState,type ReactNode } from 'react';
import { NAV,type Page } from '../nav';
import { canAccessPage } from '../lib/access';
import { NAV_GROUPS } from '../lib/navigation';
import { INTRO_EVENT } from './StartupExperience';
const labels:Partial<Record<Page,string>>={'Live Feeds':'Torn Data Browser'};
const label=(p:Page)=>labels[p]??p;
const readPreference=(key:string,fallback:string)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}};
export default function SpatialShell({page,signedIn,role,shared,onNavigate,children}:{page:Page;signedIn:boolean;role:string;shared:boolean;onNavigate:(page:Page)=>void;children:ReactNode}){
 const [theme,setTheme]=useState(()=>readPreference('tcc-theme','light'));
 const [motion,setMotion]=useState(()=>readPreference('tcc-motion','full'));
 const [systemReduced,setSystemReduced]=useState(()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
 const [open,setOpen]=useState(false),animated=motion!=='reduced'&&!systemReduced;
 useEffect(()=>{
  document.documentElement.dataset.theme=theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#080d19':'#eaf0f8');
  try{localStorage.setItem('tcc-theme',theme);}catch{}
 },[theme]);
 useEffect(()=>{
  document.documentElement.dataset.motion=animated?'full':'reduced';
  try{localStorage.setItem('tcc-motion',motion);}catch{}
  window.dispatchEvent(new Event('torn:motion-change'));
 },[motion,animated]);
 useEffect(()=>{
  if(typeof matchMedia!=='function')return;
  const media=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setSystemReduced(media.matches);
  media.addEventListener('change',change);return()=>media.removeEventListener('change',change);
 },[]);
 useEffect(()=>{setOpen(false);},[page]);
 useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);},[]);
 const allowed=NAV.filter(p=>canAccessPage(p,signedIn,role));
 const navigate=(p:Page)=>{onNavigate(p);setOpen(false);window.scrollTo({top:0,behavior:'instant'});};
 return <div className={`layout simple-layout cosmic-layout ${open?'navigation-open':''}`}>
  <div className="cosmic-ambient" aria-hidden="true"><div className="cosmic-aurora cosmic-aurora-one"/><div className="cosmic-aurora cosmic-aurora-two"/><div className="cosmic-star-dust"/></div>
  <a className="skip-link" href="#workspace-content" onClick={e=>{e.preventDefault();document.getElementById('workspace-content')?.focus();}}>Skip to content</a>
  <button className="nu-btn menu-btn" aria-label={open?'Close navigation':'Open navigation'} aria-expanded={open} aria-controls="simple-navigation" onClick={()=>setOpen(!open)}>Menu</button>
  {open&&<button className="navigation-backdrop" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}
  <nav id="simple-navigation" className={`sidebar ${open?'open':''}`} aria-label="Main">
   <button className="brand cosmic-brand" onClick={()=>navigate(signedIn?'Overview':'Settings')}><span className="cosmic-brand-mark" aria-hidden="true">T<span>.</span></span><span>Torn Helper<small>YOUR PERSONAL ORBIT</small></span></button>
   <div className="nav-scroll">{Object.entries(NAV_GROUPS).map(([category,names])=>{const pages=allowed.filter(p=>names.includes(p));return pages.length?<details className="tool-category" key={category} open><summary>{category}</summary>{pages.map(p=><button key={p} className={`nav-item ${p===page&&!shared?'active':''}`} aria-current={p===page&&!shared?'page':undefined} onClick={()=>navigate(p)}><span className="cosmic-nav-dot" aria-hidden="true"/>{label(p)}<span className="cosmic-nav-arrow" aria-hidden="true">↗</span></button>)}</details>:null;})}</div>
   <small className="simple-account"><span className="cosmic-account-ring" aria-hidden="true"/>{signedIn?'Account connected':'Sign in with your Torn key'}</small>
  </nav>
  <main id="workspace-content" className="content" tabIndex={-1}><header className="topbar"><div><p className="cosmic-eyebrow">TORN / WORKSPACE</p><h1>{shared?'Shared snapshot':signedIn?label(page):'Torn Helper'}</h1></div><div className="cosmic-header-actions">
   <button className="nu-btn intro-replay" title={animated?'Replay the galaxy flight':'Enable motion to replay the galaxy intro'} disabled={!animated} onClick={()=>window.dispatchEvent(new Event(INTRO_EVENT))}><span aria-hidden="true">✧</span> Replay intro</button>
   <button className="nu-btn" aria-pressed={!animated} disabled={systemReduced} title={systemReduced?'Reduced motion follows your device setting':'Turn interface animations on or off'} onClick={()=>setMotion(animated?'reduced':'full')}>{animated?'Reduce motion':'Motion reduced'}</button>
   <button className="nu-btn" aria-label={theme==='dark'?'Switch to light mode':'Switch to dark mode'} onClick={()=>setTheme(theme==='dark'?'light':'dark')}><span aria-hidden="true">{theme==='dark'?'☼':'☾'}</span> {theme==='dark'?'Light mode':'Dark mode'}</button>
  </div></header><div key={shared?'shared':page} className="workspace-stage">{children}</div><footer className="workspace-footer"><span className="cosmic-footer-star" aria-hidden="true">✧</span>Torn Helper · {shared?'Published snapshot':'Your personal tools'}</footer></main>
 </div>;
}
