import {useState} from 'react';
import {useWarTargets} from './WarTargetProvider';
import {defaultWarPreferences,type WarAlertPreferences} from '../lib/war-targets';
export default function WarAlertSettings(){
 const {preferences=defaultWarPreferences,savePreferences,testAlert}=useWarTargets();
 const [draft,setDraft]=useState<WarAlertPreferences|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const values=draft??preferences;
 return <details className="card"><summary>Hospital alert settings</summary><form onSubmit={async e=>{e.preventDefault();setBusy(true);try{await savePreferences(values);setDraft(null);setMessage('Alert preferences saved.');}catch(e){setMessage(e instanceof Error?e.message:'Could not save preferences.');}finally{setBusy(false);}}}>
  <label>Warn before release (seconds)<input className="nu-input" type="number" min={5} max={120} step={1} value={values.lead_seconds} onChange={e=>setDraft({...values,lead_seconds:Number(e.target.value)})}/></label>
  <label>Sound<select className="nu-input" value={values.sound} onChange={e=>setDraft({...values,sound:e.target.value as WarAlertPreferences['sound']})}><option value="off">Silent</option><option value="soft">Soft chime</option><option value="double">Double beep</option></select></label>
  <label>Volume · {Math.round(values.volume*100)}%<input type="range" min={0} max={100} value={Math.round(values.volume*100)} onChange={e=>setDraft({...values,volume:Number(e.target.value)/100})}/></label>
  <label><input type="checkbox" checked={values.desktop} onChange={e=>setDraft({...values,desktop:e.target.checked})}/> Desktop popups when browser permission is granted</label>
  <button className="nu-btn" disabled={busy}>Save alerts</button><button className="nu-btn" type="button" onClick={testAlert}>Test saved alert</button><p role="status">{message}</p><p>Sound may require interacting with this tab after opening it. Keep the app open for timed alerts.</p>
 </form></details>;
}
