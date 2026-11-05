import {useEffect,useState} from 'react';
import {useBrowserTornKey} from '../hooks/useBrowserTornKey';
import {removeBrowserTornKey,notifyBrowserKeyChange} from '../lib/browser-torn-key';
export default function BrowserTornKeyCard({ownerId,disabled=false}:{ownerId:string;disabled?:boolean}){
 const {copy,error}=useBrowserTornKey(ownerId),[revealed,setRevealed]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{setRevealed(false);if(copy)setMessage('');},[ownerId,copy?.savedAt]);
 useEffect(()=>setMessage(''),[ownerId]);
 function forget(){try{removeBrowserTornKey(localStorage,ownerId);notifyBrowserKeyChange(ownerId);setRevealed(false);setMessage('Browser copy removed. The encrypted backend copy is unchanged.');}catch{setMessage('This browser blocked removal. Clear this site’s browser storage to remove its local copy.');}}
 return <section className="card"><h3>Key saved in this browser</h3>
  <p>This shows only the copy you entered and saved on this device. The encrypted backend key is never fetched or returned to the frontend. Another browser or device will not receive this copy.</p>
  {copy?<><label>Browser copy · Torn #{copy.tornId}<input className="nu-input" type={revealed?'text':'password'} value={copy.key} readOnly autoComplete="off" spellCheck={false}/></label><button className="nu-btn" type="button" disabled={disabled} aria-pressed={revealed} onClick={()=>setRevealed(!revealed)}>{revealed?'Hide browser copy':'Show browser copy'}</button><p>Saved on this device {new Date(copy.savedAt).toLocaleString()}. It may differ from a backend key replaced on another device.</p></>:<p>{error?'This browser does not allow access to local storage.':'No usable key copy is saved in this browser. Enter your key again above and enable storage to save it here.'}</p>}
  <button className="nu-btn" type="button" disabled={disabled} onClick={forget}>Remove browser copy only</button><p>The browser copy remains on this device until removed, including after sign-out. Use a trusted, private device. Removing only this copy does not stop backend updates.</p>
  {message&&<p role="status">{message}</p>}
 </section>;
}
