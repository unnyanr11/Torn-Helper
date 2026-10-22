import { useEffect,useRef,useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { functionError } from '../lib/function-error';
import { useItemCatalogue,readSavedCatalogue,type SavedItemCatalogue } from '../hooks/useItemCatalogue';
import { parseItemCatalogue } from '../lib/item-catalogue';
import KeyDisclosure from './KeyDisclosure';
export default function ItemCatalogueLoader({disabled=false}:{disabled?:boolean}){
 const client=useQueryClient(),catalogue=useItemCatalogue(),[mode,setMode]=useState('request'),[key,setKey]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[refresh,setRefresh]=useState(false);
 const request=useRef<AbortController|null>(null),count=catalogue.data?.item_count??0;
 useEffect(()=>()=>{request.current?.abort();},[]);
 async function load(){
  if(busy||disabled||mode==='request'&&!/^[A-Za-z0-9]{16}$/.test(key))return;
  const controller=new AbortController();request.current=controller;setBusy(true);setMessage('');setError('');const apiKey=mode==='request'?key:undefined;setKey('');
  try{
   const previous=await supabase.rpc('get_torn_item_catalogue');if(previous.error)throw previous.error;
   if(controller.signal.aborted)return;
   let saved=readSavedCatalogue(previous.data),unchanged=true;
   const due=refresh&&(!saved.fetched_at||Date.now()-Date.parse(saved.fetched_at)>=86400000);
   if(!saved.item_count||due){
    const parameters:Record<string,string>={cat:'All',...(refresh?{timestamp:String(Math.floor(Date.now()/1000))}:{})};
    const r=await supabase.functions.invoke('torn-data',{body:{endpoint_id:'v2-torn-items',parameters,...(apiKey?{apiKey}:{})},signal:controller.signal});
    if(controller.signal.aborted)return;if(r.error||r.data?.error)throw await functionError(r.data,r.error);
    if(r.data?.endpoint_id!=='v2-torn-items'||r.data?.next_parameters)throw new Error('Torn did not return the complete item catalogue.');
    parseItemCatalogue(r.data.payload);
    const result=await supabase.rpc('get_torn_item_catalogue');if(result.error)throw result.error;
    saved=readSavedCatalogue(result.data);unchanged=saved.fetched_at===previous.data?.fetched_at;
    if(!saved.item_count||unchanged)throw new Error('The backend kept the previous catalogue because this import was incomplete or another import is running. Retry shortly.');
   }
   if(controller.signal.aborted)return;
   await client.cancelQueries({queryKey:['item-catalogue']});if(controller.signal.aborted)return;
   client.setQueryData<SavedItemCatalogue>(['item-catalogue'],saved);
   setMessage(`${saved.item_count.toLocaleString()} items ${unchanged?'reused from the backend':'saved permanently in the backend'}.${refresh&&unchanged?' The catalogue was refreshed within 24 hours; no Torn call was made.':''}`);setRefresh(false);
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Unable to load Torn items.');}
  finally{if(!controller.signal.aborted)setBusy(false);}
 }
 return <details className="item-catalogue-loader"><summary>{count?`${count.toLocaleString()} items saved · catalogue options`:'Load all Torn items once'}</summary>
  <p>Item IDs, names, categories and weapon types are shared reference data stored permanently in the backend. Dropdowns reuse them without calling Torn again. No prices, inventory or API keys are stored in this catalogue.</p>
  <button type="button" className="nu-btn" disabled={busy||disabled||catalogue.isFetching} onClick={()=>void catalogue.refetch()}>Reload saved catalogue · no Torn call</button>
  {catalogue.data?.fetched_at&&<p>Last import: {new Date(catalogue.data.fetched_at).toLocaleString()}.</p>}
  {catalogue.isError&&<p role="alert">Unable to read the saved catalogue. <button type="button" className="nu-btn" disabled={busy} onClick={()=>void catalogue.refetch()}>Retry backend read</button></p>}
  {count>0&&<label><input type="checkbox" checked={refresh} disabled={busy||disabled} onChange={e=>setRefresh(e.target.checked)}/> Refresh from Torn for newly added or renamed items (at most once per 24 hours)</label>}
  {(!count||refresh)&&<><label>Key to use<select className="nu-input" value={mode} disabled={busy||disabled} onChange={e=>{setMode(e.target.value);setKey('');}}><option value="request">Use a key for this import</option><option value="stored">Use my saved encrypted key</option></select></label>
  {mode==='request'&&<><label>Torn API key<input className="nu-input" type="password" autoComplete="off" spellCheck={false} maxLength={16} value={key} disabled={busy||disabled} onChange={e=>setKey(e.target.value.trim())}/></label><KeyDisclosure persist={false}/></>}
  <p>Public Only access is sufficient for the items endpoint. Use a key belonging to your linked Torn account; Custom keys need the items selection. The key is cleared when this import starts.</p>
  <button type="button" className="nu-btn" disabled={disabled||busy||mode==='request'&&!/^[A-Za-z0-9]{16}$/.test(key)} onClick={()=>void load()}>{busy?'Saving catalogue…':refresh?'Refresh saved catalogue':'Fetch all item names and IDs once'}</button></>}
  {count>0&&!refresh&&<p>The saved catalogue has no automatic expiry. Live prices still refresh separately.</p>}
  {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
 </details>;
}
