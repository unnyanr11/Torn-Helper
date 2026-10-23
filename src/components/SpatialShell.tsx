import { useEffect,useState,type ReactNode } from 'react';
import { NAV,type Page } from '../nav';
import { canAccessPage } from '../lib/access';
import { NAV_GROUPS } from '../lib/navigation';
import { INTRO_EVENT } from './StartupExperience';
const labels:Partial<Record<Page,string>>={'Live Feeds':'Torn Data Browser'};
const label=(p:Page)=>labels[p]??p;
const readPreference=(key:string,fallback:string)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}};
export default function SpatialShell({page,signedIn,role,shared,onNavigate,children,accountId}:{accountId?:string|null;page:Page;signedIn:boolean;role:string;shared:boolean;onNavigate:(page:Page)=>void;children:ReactNode}){
 const scope=`tcc-navigation:${accountId??'signed-out'}`;
 const readNav=()=>{try{const value=JSON.parse(localStorage.getItem(scope)??'{}');return {favourites:Array.isArray(value.favourites)?value.favourites.filter((p:Page)=>NAV.includes(p)):[],recent:Array.isArray(value.recent)?value.recent.filter((p:Page)=>NAV.includes(p)):[]};}catch{return {favourites:[],recent:[]};}};
 const [preferences,setPreferences]=useState<{favourites:Page[];recent:Page[]}>(readNav),[search,setSearch]=useState(''),[expanded,setExpanded]=useState<Record<string,boolean>>({});
 function saveNav(next:typeof preferences){setPreferences(next);try{localStorage.setItem(scope,JSON.stringify(next));}catch{}}
 useEffect(()=>{setExpanded(old=>({...old,...Object.fromEntries(Object.entries(NAV_GROUPS).filter(([,pages])=>pages.includes(page)).map(([name])=>[name,true]))}));},[page]);
 useEffect(()=>{setPreferences(old=>{const next={...old,recent:[page,...old.recent.filter(p=>p!==page)].slice(0,6)};try{localStorage.setItem(scope,JSON.stringify(next));}catch{}return next;});},[page,scope]);
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
 const navigate=(p:Page)=>{saveNav({...preferences,recent:[p,...preferences.recent.filter(item=>item!==p)].slice(0,6)});setSearch('');onNavigate(p);setOpen(false);window.scrollTo({top:0,behavior:'instant'});};
 return <div className={`layout simple-layout cosmic-layout ${open?'navigation-open':''}`}>
  <div className="cosmic-ambient" aria-hidden="true"><div className="cosmic-aurora cosmic-aurora-one"/><div className="cosmic-aurora cosmic-aurora-two"/><div className="cosmic-star-dust"/></div>
  <a className="skip-link" href="#workspace-content" onClick={e=>{e.preventDefault();document.getElementById('workspace-content')?.focus();}}>Skip to content</a>
  <button className="nu-btn menu-btn" aria-label={open?'Close navigation':'Open navigation'} aria-expanded={open} aria-controls="simple-navigation" onClick={()=>setOpen(!open)}>Menu</button>
  {open&&<button className="navigation-backdrop" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}
  <nav id="simple-navigation" className={`sidebar ${open?'open':''}`} aria-label="Main">
   <button className="brand cosmic-brand" onClick={()=>navigate(signedIn?'Overview':'Settings')}><span className="cosmic-brand-mark" aria-hidden="true">T<span>.</span></span><span>Torn Helper<small>YOUR PERSONAL WORKSPACE</small></span></button>
   <label className="tool-search">Find a tool<input className="nu-input" type="search" placeholder="Search all tools…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   <div className="nav-scroll">
    {!search&&[['Favourites',preferences.favourites],['Recently used',preferences.recent]].map(([title,items])=><div className="nav-shortcuts" key={title as string}>{(items as Page[]).some(p=>allowed.includes(p))&&<><small>{title}</small>{(items as Page[]).filter(p=>allowed.includes(p)).map(p=><button className="nav-item" key={p} onClick={()=>navigate(p)}>{label(p)}</button>)}</>}</div>)}
    {Object.entries(NAV_GROUPS).map(([category,names])=>{const pages=allowed.filter(p=>names.includes(p)&&label(p).toLowerCase().includes(search.toLowerCase()));return pages.length?<details className="tool-category" key={category} open={!!search||(expanded[category]??names.includes(page))} onToggle={e=>{if(!search){const isOpen=e.currentTarget.open;setExpanded(old=>old[category]===isOpen?old:{...old,[category]:isOpen});}}}><summary>{category}</summary>{pages.map(p=><div className="nav-tool-row" key={p}><button className={`nav-item ${p===page&&!shared?'active':''}`} aria-current={p===page&&!shared?'page':undefined} onClick={()=>navigate(p)}><span className="cosmic-nav-dot" aria-hidden="true"/>{label(p)}</button><button className="favourite-tool" aria-label={`${preferences.favourites.includes(p)?'Remove':'Add'} ${label(p)} ${preferences.favourites.includes(p)?'from':'to'} favourites`} aria-pressed={preferences.favourites.includes(p)} onClick={()=>saveNav({...preferences,favourites:preferences.favourites.includes(p)?preferences.favourites.filter(item=>item!==p):[...preferences.favourites,p]})}>{preferences.favourites.includes(p)?'★':'☆'}</button></div>)}</details>:null;})}
    {search&&!allowed.some(p=>label(p).toLowerCase().includes(search.toLowerCase()))&&<p role="status">No matching tools.</p>}
   </div>
   <small className="simple-account"><span className="cosmic-account-ring" aria-hidden="true"/>{signedIn?'Account connected':'Sign in with your Torn key'}</small>
  </nav>
  <main id="workspace-content" className="content" tabIndex={-1}><header className="topbar"><div><p className="cosmic-eyebrow">TORN / WORKSPACE</p><h1>{shared?'Shared snapshot':signedIn?label(page):'Torn Helper'}</h1></div><div className="cosmic-header-actions">
   <details className="appearance-menu"><summary className="nu-btn">Appearance</summary><div className="appearance-options"><button className="nu-btn intro-replay" title={animated?'Replay the galaxy flight':'Enable motion to replay the galaxy intro'} disabled={!animated} onClick={()=>window.dispatchEvent(new Event(INTRO_EVENT))}><span aria-hidden="true">✧</span> Replay intro</button>
   <button className="nu-btn" aria-pressed={!animated} disabled={systemReduced} title={systemReduced?'Reduced motion follows your device setting':'Turn interface animations on or off'} onClick={()=>setMotion(animated?'reduced':'full')}>{animated?'Reduce motion':'Motion reduced'}</button>
   <button className="nu-btn" aria-label={theme==='dark'?'Switch to light mode':'Switch to dark mode'} onClick={()=>setTheme(theme==='dark'?'light':'dark')}><span aria-hidden="true">{theme==='dark'?'☼':'☾'}</span> {theme==='dark'?'Light mode':'Dark mode'}</button>
  </div></details></div></header><div key={shared?'shared':page} className="workspace-stage">{children}</div><footer className="workspace-footer"><span className="cosmic-footer-star" aria-hidden="true">✧</span>Torn Helper · {shared?'Published snapshot':'Your personal tools'}</footer></main>
 </div>;
}
