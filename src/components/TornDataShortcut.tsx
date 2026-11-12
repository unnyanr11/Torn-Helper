import {INVENTORY_CATEGORIES,inventorySnapshot} from '../lib/inventory-data';
import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useCurrentObservations} from '../hooks/useSavedObservations';
import {pageDatasets} from '../lib/account-preparation';
import {CONNECTED_REQUESTS} from '../lib/connected-data';
import {observationKey} from '../lib/personal-data';
import {invokeTornData} from '../lib/torn-data-client';
import {functionError} from '../lib/function-error';
import TornDataView from './TornDataView';
import TimerPanel from './TimerPanel';
export default function TornDataShortcut({page}:{page:string}){
 const cache=useCurrentObservations(),client=useQueryClient(),[busy,setBusy]=useState(''),[error,setError]=useState('');
 const [inventoryCategory,setInventoryCategory]=useState('Drug');
 const sections=pageDatasets(page);
 if(!sections.length)return null;
 return <section className="card connected-page-data" aria-label={`Collected Torn data for ${page}`}>
  <TimerPanel page={page}/><h2>Your Torn data</h2><p>Only dashboard essentials load during setup. Load an optional section when you need it; saved observations are reused.</p>
  {error&&<p role="alert">{error}</p>}
  {sections.map(section=>{
   const seed=CONNECTED_REQUESTS.find(row=>row.capability.id===section.id&&(page!=='Armory History'||row.parameters.cat==='armoryAction')&&(section.path!=='/user/inventory'||row.parameters.cat===inventoryCategory)),parameters=seed?.parameters??{};
   const expected=observationKey(section.id,parameters);
   const inventoryEntry=section.path==='/user/inventory'?Object.values(cache.data??{}).filter(row=>row.observation?.endpoint_id===section.id&&row.observation.parameters.cat===inventoryCategory&&Number(row.observation.parameters.offset??0)===0).sort((a,b)=>Date.parse(b.observation!.fetched_at)-Date.parse(a.observation!.fetched_at))[0]:undefined;
   const entry=inventoryEntry??cache.data?.[expected]??Object.entries(cache.data??{}).filter(([id,row])=>{
    if(!id.startsWith(section.id+':'))return false;
    const params=row.observation?.parameters;
    return !!params&&Object.keys(params).every(key=>key==='limit'||key==='offset'||params[key]===parameters[key])&&Object.entries(parameters).every(([key,value])=>params[key]===value);
   }).sort(([,a],[,b])=>Date.parse(b.observation?.fetched_at??'')-Date.parse(a.observation?.fetched_at??''))[0]?.[1];
   const observation=entry?.observation;
   const refresh=async()=>{
    setBusy(section.id);setError('');
    try{const response=await invokeTornData(client,{body:{endpoint_id:section.id,parameters,refresh:true}});if(response.error||response.data?.error)throw await functionError(response.data,response.error);}
    catch(failure){setError(failure instanceof Error?failure.message:'Unable to refresh this section.');}
    finally{setBusy('');}
   };
   return <details key={section.id} open={sections.length===1}>
    <summary>{seed?.label??section.summary} · {observation?'Loaded':entry?.error?'Needs attention':'Not collected'}</summary>
    {section.path==='/user/inventory'&&<><label>Inventory category<select className="nu-input" value={inventoryCategory} onChange={e=>setInventoryCategory(e.target.value)}>{INVENTORY_CATEGORIES.map(cat=><option key={cat}>{cat}</option>)}</select></label><p>{inventorySnapshot(cache.data??{}).categories} of {INVENTORY_CATEGORIES.length} categories collected. Showing the returned first page for {inventoryCategory}; use the full data browser for additional pages.</p></>}
    {observation?<><p className="observation-time">Observed {new Date(observation.fetched_at).toLocaleString()}</p><TornDataView value={observation.payload}/></>:<p>{entry?.error??'No data was returned for this section. It may require different key permissions or a faction/company role.'}</p>}
    {observation&&entry?.error&&<p role="status">{entry.error} Showing the last successful observation.</p>}
    <button className="nu-btn" type="button" disabled={!!busy} onClick={()=>void refresh()}>{busy===section.id?'Loading…':observation?'Refresh this section':'Load this section'}</button>{' '}
    <a href={`#Live%20Feeds?${new URLSearchParams({section:section.id,...parameters})}`}>Open full data browser</a>
   </details>;
  })}
 </section>;
}
