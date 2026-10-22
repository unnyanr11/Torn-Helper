import { useState } from 'react';
import { FOCUS_OPTIONS,validFocus,type WorkspaceFocus } from '../lib/workspace-focus';
export default function WorkspaceWelcome({focus,onChoose,storageError=false}:{focus:WorkspaceFocus|null;onChoose:(focus:WorkspaceFocus)=>void;storageError?:boolean}){
 const [editing,setEditing]=useState(false),[selected,setSelected]=useState<string>(focus??'');
 const current=FOCUS_OPTIONS.find(f=>f.id===focus),preview=FOCUS_OPTIONS.find(f=>f.id===selected);
 return <article className="card workspace-welcome">
  {!current||editing?<><h3>What would you like to do first?</h3><p>Choose a starting point. Every category stays available, and you can change this later.</p><form onSubmit={e=>{e.preventDefault();if(validFocus(selected)){onChoose(selected);setEditing(false);}}}>
   <label>Main goal<select className="nu-input" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose your goal…</option>{FOCUS_OPTIONS.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
   {preview&&<p>{preview.description}</p>}<button className="nu-btn" disabled={!validFocus(selected)}>Use this starting point</button>{editing&&<button type="button" className="nu-btn" onClick={()=>setEditing(false)}>Cancel</button>}
  </form><small>{storageError?'This browser could not save your preference. It works until you leave.':'Your starting point is saved on this device.'}</small></>:<>
   <div className="home-heading"><h3>Your starting point · {current.label}</h3><button type="button" className="nu-btn" onClick={()=>{setSelected(focus??'');setEditing(true);}}>Change goal</button></div>
   <p>{current.description}</p><nav aria-label="Recommended tools" className="home-shortcuts">{current.tools.map(([page,label])=><a className="nu-btn" key={page} href={`#${encodeURIComponent(page)}`}>{label}</a>)}</nav>
   {storageError&&<p role="status">Your preference could not be saved on this device.</p>}
  </>}
 </article>;
}
