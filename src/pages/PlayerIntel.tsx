import ChoiceInput from '../components/ChoiceInput';
import KeyDisclosure from '../components/KeyDisclosure';
import { useTornChoices } from '../hooks/useTornChoices';
import { observedChoices } from '../lib/entry-options';
import { functionError } from '../lib/function-error';
import { useEffect,useRef,useState } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { invokeTornData } from '../lib/torn-data-client';
import { observationKey,type TornObservation } from '../lib/personal-data';
import { lookupPlayerProfile,playerId,PLAYER_PROFILE_ENDPOINT,profileHistory } from '../lib/player-intel';
import { object } from '../lib/connected-data';
export default function PlayerIntel(){
 const choices=useTornChoices(),client=useQueryClient();
 const preset=new URLSearchParams(location.hash.split('?')[1]??'').get('player')??'';
 const [input,setInput]=useState(preset),[player,setPlayer]=useState(preset),[key,setKey]=useState('');
 const [chosenMode,setMode]=useState<'request'|'stored'|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[warning,setWarning]=useState('');
 const pending=useRef<AbortController|null>(null),keyInput=useRef<HTMLInputElement>(null);
 const keyStatus=useQuery({queryKey:['torn-key-status',choices.owner],enabled:!!choices.owner,retry:false,staleTime:0,queryFn:async()=>{
  const response=await supabase.from('encrypted_credentials').select('provider').eq('user_id',choices.owner!).eq('provider','torn').maybeSingle();
  if(response.error)throw response.error;return {hasStoredKey:!!response.data};
 }});
 const mode=chosenMode??(keyStatus.data?.hasStoredKey?'stored':'request');
 const ready=!!choices.owner&&(mode==='stored'?keyStatus.data?.hasStoredKey!==false:/^[A-Za-z0-9]{16}$/.test(key));
 useEffect(()=>()=>{pending.current?.abort();},[]);
 const observation=choices.entries[observationKey(PLAYER_PROFILE_ENDPOINT,{id:player})]?.observation;
 const candidate=object(object(observation?.payload).profile),p=candidate.id===Number(player)?candidate:null;
 async function lookup(value=input){
  if(pending.current&&!pending.current.signal.aborted)return;
  setError('');setWarning('');
  let id:number;try{id=playerId(value);}catch(failure){setError((failure as Error).message);return;}
  if(!ready){setError(mode==='request'?'Enter your Torn key for this lookup.':'No key was retained. Choose a request-only key or save an encrypted key in Settings.');keyInput.current?.focus();return;}
  const controller=new AbortController();pending.current=controller;setBusy(true);setPlayer(String(id));const secret=mode==='request'?key:undefined;setKey('');
  try{
   const result=await lookupPlayerProfile(String(id),secret,controller.signal,async(body,signal)=>{
    const response=await invokeTornData(client,{body,signal});if(response.error||response.data?.error)throw await functionError(response.data,response.error);return response.data;
   });
   if(!result.cached&&choices.owner){
    try{const recorded=await supabase.from('player_observations').insert(profileHistory(choices.owner,result));
     if(controller.signal.aborted)return;
     if(recorded.error)setWarning('Profile loaded, but this observation could not be added to your history.');
    }catch{if(!controller.signal.aborted)setWarning('Profile loaded, but this observation could not be added to your history.');}
   }
  }catch(failure){if(!controller.signal.aborted)setError(failure instanceof Error?failure.message:'Unable to load this player.');}
  finally{if(pending.current===controller){pending.current=null;if(!controller.signal.aborted)setBusy(false);}}
 }
 return <section><h2>Player Intel</h2><p>Public profiles from Torn. Private battle stats are unknown unless you have authorized evidence.</p>
  <form onSubmit={event=>{event.preventDefault();void lookup();}}>
   <ChoiceInput label="Player" value={input} disabled={busy} onChange={value=>{setInput(value);setPlayer(value);setError('');setWarning('');}} options={observedChoices(choices.data??[],'player')} inputMode="numeric" required/>
   <label>Key to use<select className="nu-input" value={mode} disabled={busy} onChange={event=>{setMode(event.target.value as 'request'|'stored');setKey('');setError('');}}><option value="request">Use a key for this lookup</option><option value="stored">Use my encrypted key from Settings</option></select></label>
   {keyStatus.data?.hasStoredKey===false&&<p>Your Torn identity can be linked without retaining a key. Enter a key for this lookup, or save an encrypted key in <a href="#Settings">Settings</a>.</p>}
   {keyStatus.isError&&<p role="status">Could not check whether a key is saved. You can still use a request-only key or try your saved key.</p>}
   {mode==='request'&&<><label>Torn API key<input ref={keyInput} className="nu-input" type="password" autoComplete="off" spellCheck={false} minLength={16} maxLength={16} value={key} disabled={busy} required onChange={event=>{setMode('request');setKey(event.target.value.trim());}}/></label><p>The key is cleared when the lookup starts and is never saved in browser storage. It must belong to your linked Torn account. Minimal access is sufficient; Custom keys need identity verification and profile access.</p><details><summary>Key privacy and access</summary><KeyDisclosure persist={false}/></details></>}
   <button className="nu-btn" disabled={busy||!ready||!input}>{busy?'Loading profile…':'Look up player'}</button>
  </form>
  {error&&<p role="alert">{error}</p>}{warning&&<p role="status">{warning}</p>}
  {p&&observation&&<article className="card"><h3>{p.name} [{p.id}]</h3><p>Level {p.level} · {p.status?.state??'Unknown status'} · Faction {p.faction_id??'none'}</p><p>Last action: {p.last_action?.status??'unknown'}</p><p>Source: official Torn API · Collected {new Date(observation.fetched_at).toLocaleString()}. Saved snapshot; refresh to check changes.</p>{error&&<p>Showing the last successful observation.</p>}<button className="nu-btn" disabled={busy||!ready} onClick={()=>void lookup(player)}>Refresh observation</button>{!ready&&<p>Enter a request-only key above to refresh, or choose your saved encrypted key.</p>}</article>}
 </section>;
}
