import { useEffect, useState, type ReactNode } from 'react';
import { NAV, type Page } from '../nav';
import { canAccessPage } from '../lib/access';
import { NAV_GROUPS } from '../lib/navigation';
const labels: Partial<Record<Page,string>> = { 'Live Feeds':'Torn Data Browser' };
const label = (p: Page) => labels[p] ?? p;
export default function SpatialShell({ page, signedIn, role, shared, onNavigate, children }: { page: Page; signedIn: boolean; role: string; shared: boolean; onNavigate:(page:Page)=>void; children:ReactNode }) {
  const [theme,setTheme] = useState(() => { try { return localStorage.getItem('tcc-theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } });
  const [open,setOpen] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme=theme;
    document.documentElement.dataset.motion='reduced';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#111827':'#f4f6f8');
    try { localStorage.setItem('tcc-theme',theme); } catch {}
  },[theme]);
  useEffect(() => { setOpen(false); },[page]);
  useEffect(() => {
    const close=(event:KeyboardEvent)=>{ if(event.key==='Escape')setOpen(false); };
    document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);
  },[]);
  const allowed=NAV.filter(p=>canAccessPage(p,signedIn,role));
  const navigate=(p:Page)=>{onNavigate(p);setOpen(false);window.scrollTo({top:0,behavior:'instant'});};
  return <div className={`layout simple-layout ${open?'navigation-open':''}`}>
    <a className="skip-link" href="#workspace-content" onClick={e=>{e.preventDefault();document.getElementById('workspace-content')?.focus();}}>Skip to content</a>
    <button className="nu-btn menu-btn" aria-label={open?'Close navigation':'Open navigation'} aria-expanded={open} aria-controls="simple-navigation" onClick={()=>setOpen(!open)}>Menu</button>
    {open && <button className="navigation-backdrop" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}
    <nav id="simple-navigation" className={`sidebar ${open?'open':''}`} aria-label="Main">
      <button className="brand" onClick={()=>navigate(signedIn?'Overview':'Settings')}>Torn Helper</button>
      <div className="nav-scroll">{Object.entries(NAV_GROUPS).map(([category,names])=>{
        const pages=allowed.filter(p=>names.includes(p));
        return pages.length?<details className="tool-category" key={category} open><summary>{category}</summary>{pages.map(p=><button key={p} className={`nav-item ${p===page&&!shared?'active':''}`} aria-current={p===page&&!shared?'page':undefined} onClick={()=>navigate(p)}>{label(p)}</button>)}</details>:null;
      })}</div>
      <small className="simple-account">{signedIn?'Account connected':'Sign in with your Torn key'}</small>
    </nav>
    <main id="workspace-content" className="content" tabIndex={-1}><header className="topbar"><h1>{shared?'Shared snapshot':signedIn?label(page):'Torn Helper'}</h1><button className="nu-btn" aria-label={theme==='dark'?'Switch to light mode':'Switch to dark mode'} onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?'Light mode':'Dark mode'}</button></header><div className="workspace-stage">{children}</div><footer className="workspace-footer">Torn Helper · {shared?'Published snapshot':'Your personal tools'}</footer></main>
  </div>;
}
