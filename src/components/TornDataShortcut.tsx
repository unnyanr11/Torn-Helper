import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useCurrentObservations} from '../hooks/useSavedObservations';
import {pageDatasets} from '../lib/account-preparation';
import {CONNECTED_REQUESTS} from '../lib/connected-data';
import {observationKey} from '../lib/personal-data';
import {invokeTornData} from '../lib/torn-data-client';
import {functionError} from '../lib/function-error';
import TornDataView from './TornDataView';
export default function TornDataShortcut({page}:{page:string}){
 const cache=useCurrentObservations(),client=useQueryClient(),[busy,setBusy]=useState(''),[error,setError]=useState('');
 const sections=pageDatasets(page);
 if(!sections.length)return null;
 return <section className="card connected-page-data" aria-label={`Collected Torn data for ${page}`}>
  <h2>Your Torn data</h2><p>Loaded for your account during setup. Each section shows its collection time; your saved tool entries appear below.</p>
  {error&&<p role="alert">{error}</p>}
  {sections.map(section=>{
   const seed=CONNECTED_REQUESTS.find(row=>row.capability.id===section.id&&(page!=='Armory History'||row.parameters.cat==='armoryAction')),parameters=seed?.parameters??{};
   const expected=observationKey(section.id,parameters);
   const entry=cache.data?.[expected]??Object.entries(cache.data??{}).filter(([id,row])=>{
    if(!id.startsWith(section.id+':'))return false;
    const params=row.observation?.parameters;
    return !!params&&Object.keys(params).every(key=>key==='limit'||key==='offset'||params[key]===parameters[key])&&Object.entries(parameters).every(([key,value])=>params[key]===value);
   }).sort(([,a],[,b])=>Date.parse(b.observation?.fetched_at??'')-Date.parse(a.observation?.fetched_at??''))[0]?.[1];
   const observation=entry?.observation;
   const refresh=async()=>{
    setBusy(section.id);setError('');
    try{const response=await invokeTornData(client,{body:{endpoint_id:section.id,parameters}});if(response.error||response.data?.error)throw await functionError(response.data,response.error);}
    catch(failure){setError(failure instanceof Error?failure.message:'Unable to refresh this section.');}
    finally{setBusy('');}
   };
   return <details key={section.id} open={sections.length===1}>
    <summary>{seed?.label??section.summary} · {observation?'Loaded':entry?.error?'Needs attention':'Not collected'}</summary>
    {observation?<><p className="observation-time">Observed {new Date(observation.fetched_at).toLocaleString()}</p><TornDataView value={observation.payload}/></>:<p>{entry?.error??'No data was returned for this section. It may require different key permissions or a faction/company role.'}</p>}
    {observation&&entry?.error&&<p role="status">{entry.error} Showing the last successful observation.</p>}
    <button className="nu-btn" type="button" disabled={!!busy} onClick={()=>void refresh()}>{busy===section.id?'Refreshing…':'Refresh this section'}</button>{' '}
    <a href={`#Live%20Feeds?${new URLSearchParams({section:section.id,...parameters})}`}>Open full data browser</a>
   </details>;
  })}
 </section>;
}
