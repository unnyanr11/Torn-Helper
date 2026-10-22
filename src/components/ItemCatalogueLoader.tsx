import { useEffect,useRef,useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { functionError } from '../lib/function-error';
import { parseItemCatalogue } from '../lib/item-catalogue';
import type { CachedChoiceRow } from '../lib/torn-choices';
import KeyDisclosure from './KeyDisclosure';
const endpoint='v2-torn-items';
export default function ItemCatalogueLoader({disabled=false}:{disabled?:boolean}){
 const client=useQueryClient(),[mode,setMode]=useState('request'),[key,setKey]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const request=useRef<AbortController|null>(null);
 useEffect(()=>()=>{request.current?.abort();},[]);
 async function load(){
  if(busy||disabled||mode==='request'&&!/^[A-Za-z0-9]{16}$/.test(key))return;
  const controller=new AbortController();request.current=controller;setBusy(true);setMessage('');setError('');const apiKey=mode==='request'?key:undefined;setKey('');
  try{
   const r=await supabase.functions.invoke('torn-data',{body:{endpoint_id:endpoint,parameters:{cat:'All'},...(apiKey?{apiKey}:{})},signal:controller.signal});
   if(controller.signal.aborted)return;
   if(r.error||r.data?.error)throw await functionError(r.data,r.error);
   const items=parseItemCatalogue(r.data?.payload);
   if(r.data?.endpoint_id!==endpoint||r.data?.next_parameters)throw new Error('Torn did not return the complete item catalogue. Your existing choices were kept.');
   await client.cancelQueries({queryKey:['torn-choices']});if(controller.signal.aborted)return;
   // Retain the original observation (including shop data when present) for existing tools.
   client.setQueryData<CachedChoiceRow[]>(['torn-choices'],old=>[{endpoint_id:endpoint,payload:r.data.payload,fetched_at:r.data.fetched_at},...(old??[]).filter(row=>row.endpoint_id!==endpoint)].slice(0,100));
   setMessage(`Loaded ${items.length.toLocaleString()} item names and IDs across ${new Set(items.map(i=>i.type)).size} categories. All item dropdowns can now use this catalogue.`);
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Unable to load Torn items.');}
  finally{if(!controller.signal.aborted)setBusy(false);}
 }
 return <details className="item-catalogue-loader"><summary>Load all Torn items</summary><p>Fetch every item returned by Torn’s full catalogue: names, IDs and categories. This fills item choices throughout your workspace. Prices require a separate live price check.</p>
  <label>Key to use<select className="nu-input" value={mode} disabled={busy||disabled} onChange={e=>{setMode(e.target.value);setKey('');}}><option value="request">Use a key for this request</option><option value="stored">Use my saved encrypted key</option></select></label>
  {mode==='request'&&<><label>Torn API key<input className="nu-input" type="password" autoComplete="off" spellCheck={false} maxLength={16} value={key} disabled={busy||disabled} onChange={e=>setKey(e.target.value.trim())}/></label><KeyDisclosure persist={false}/></>}
  <p>The items endpoint accepts Public Only access. Your key must belong to your linked Torn account; Custom keys need the items selection. The key is cleared when the request starts. The existing private observation cache retains the returned catalogue for up to 24 hours.</p>
  <button type="button" className="nu-btn" disabled={disabled||busy||mode==='request'&&!/^[A-Za-z0-9]{16}$/.test(key)} onClick={()=>void load()}>{busy?'Loading full catalogue…':'Fetch all item names and IDs'}</button>
  {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
 </details>;
}
