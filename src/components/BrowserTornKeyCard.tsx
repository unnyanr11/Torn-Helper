import {useEffect,useState} from 'react';
import {useBrowserTornKey} from '../hooks/useBrowserTornKey';
import {removeBrowserTornKey,notifyBrowserKeyChange} from '../lib/browser-torn-key';
export default function BrowserTornKeyCard({ownerId,disabled=false}:{ownerId:string;disabled?:boolean}){
 const {copy,error}=useBrowserTornKey(ownerId),[revealed,setRevealed]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{setRevealed(false);if(copy)setMessage('');},[ownerId,copy?.savedAt]);
 useEffect(()=>setMessage(''),[ownerId]);
 function forget(){try{removeBrowserTornKey(localStorage,ownerId);notifyBrowserKeyChange(ownerId);setRevealed(false);setMessage('Session copy removed. The encrypted backend copy is unchanged.');}catch{setMessage('This browser blocked removal. Clear this site’s browser storage to remove its local copy.');}}
 return <section className="card"><h3>Key in session memory</h3>
  <p>This shows only the copy you entered during this page session. The encrypted backend key is never fetched or returned to the frontend. Another browser or device will not receive this copy.</p>
  {copy?<><label>Session copy · Torn #{copy.tornId}<input className="nu-input" type={revealed?'text':'password'} value={copy.key} readOnly autoComplete="off" spellCheck={false}/></label><button className="nu-btn" type="button" disabled={disabled} aria-pressed={revealed} onClick={()=>setRevealed(!revealed)}>{revealed?'Hide session copy':'Show session copy'}</button><p>Held in memory since {new Date(copy.savedAt).toLocaleString()}. It may differ from a backend key replaced on another device.</p></>:<p>{error?'This browser does not allow access to local storage.':'No usable key copy is held in this session. Enter your key above to keep a temporary copy.'}</p>}
  <button className="nu-btn" type="button" disabled={disabled} onClick={forget}>Remove session copy only</button><p>The session copy clears on reload, sign-out, or account switch. It is never saved to local storage. Removing only this copy does not stop backend updates.</p>
  {message&&<p role="status">{message}</p>}
 </section>;
}
