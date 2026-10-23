import type { Ref } from 'react';
import { useTornConnection } from '../hooks/useTornConnection';
import KeyDisclosure from './KeyDisclosure';
export default function TornConnectionPanel({mode,onMode,keyValue,onKey,disabled=false,memory=false,onMemory,inputRef,allowSaved=false}:{mode:string;onMode:(value:string)=>void;keyValue:string;onKey:(value:string)=>void;disabled?:boolean;memory?:boolean;onMemory?:(value:boolean)=>void;inputRef?:Ref<HTMLInputElement>;allowSaved?:boolean}){
 const {owner,status,verification}=useTornConnection(),identity=status.data?.identity;
 return <details className="connection-panel" open={!status.data?.hasStoredKey&&mode!=='saved'}><summary>Torn connection · {status.isPending?'Checking account…':status.isError?'Check unavailable':status.data?.hasStoredKey?'Encrypted key saved':'Request-only key'}</summary>
  <dl className="data-metrics"><div><dt>Identity</dt><dd>{!owner?'Account loading':identity&&!identity.revoked_at?`${identity.torn_name} [${identity.torn_id}]`:'Not linked'}</dd></div><div><dt>Key retained</dt><dd>{status.isPending?'Checking…':status.isError?'Unknown':status.data?.hasStoredKey?'Encrypted on server':'No'}</dd></div><div><dt>Permissions</dt><dd>{verification?'Confirmed for last checked section':'Not verified this session'}</dd></div><div><dt>Last successful live check</dt><dd>{verification?new Date(verification.at).toLocaleString():'Not checked this session'}</dd></div></dl>
  <p>{verification?`Access confirmed for ${verification.endpoint} using a ${verification.mode==='stored'?'saved':'request-only'} key at that check. Other sections may need different permissions.`:'Saving a key or linking an identity does not confirm current endpoint permissions. A successful live request confirms access to that section.'}</p>
  {identity?.key_access_level&&<p>Access level recorded when linked: {identity.key_access_level}. Current access is checked by Torn per section.</p>}
  {status.isError&&<p role="status">Connection metadata could not be checked. You may still try a request-only or saved key.</p>}
  <label>Key to use<select className="nu-input" value={mode} disabled={disabled} onChange={e=>{onMode(e.target.value);onKey('');}}><option value="request">Use a request-only key</option><option value="stored">Use my encrypted key from Settings</option>{allowSaved&&<option value="saved">Saved observations only · no API requests</option>}</select></label>
  {mode==='stored'&&status.data?.hasStoredKey===false&&<p role="status">Your identity is linked, but no key was retained. Choose a request-only key or save an encrypted key in <a href="#Settings">Settings</a>.</p>}
  {mode==='request'&&<><label>Torn API key<input ref={inputRef} className="nu-input" type="password" autoComplete="off" spellCheck={false} minLength={16} maxLength={16} value={keyValue} disabled={disabled} required onChange={e=>onKey(e.target.value.trim())}/></label>
   {onMemory&&<label><input type="checkbox" checked={memory} disabled={disabled} onChange={e=>onMemory(e.target.checked)}/> Keep this key in page memory for rechecks; leaving clears it</label>}
   <p>{memory?'The key stays in page memory for updates until you leave.':'The key is cleared when a request starts.'} It is never saved in browser storage. Use a key belonging to your linked Torn account.</p><details><summary>Key privacy and access</summary><KeyDisclosure persist={false} session={memory}/></details></>}
  <a href="#Settings">Manage connection</a>
 </details>;
}
