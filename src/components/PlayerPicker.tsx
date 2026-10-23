import { useId,useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTornChoices } from '../hooks/useTornChoices';
import { supabase } from '../lib/supabase';
import { observedChoices,mergeChoices } from '../lib/entry-options';
import { playerInput } from '../lib/player-picker';
import { searchChoices } from '../lib/choice-search';
export default function PlayerPicker({label='Player',value,onChange,disabled=false,required=false}:{label?:string;value:string;onChange:(value:string)=>void;disabled?:boolean;required?:boolean}){
 const choices=useTornChoices(),id=useId(),[search,setSearch]=useState('');
 const targets=useQuery({queryKey:['player-picker-targets',choices.owner],enabled:!!choices.owner,staleTime:60000,queryFn:async()=>{
  const r=await supabase.from('target_list_entries').select('torn_player_id,player_name,target_lists!inner(user_id)').eq('target_lists.user_id',choices.owner!).limit(500);if(r.error)throw r.error;return r.data;
 }});
 const rows=choices.data??[],groups=[
  {label:'Recent players',options:mergeChoices(...rows.filter(r=>r.endpoint_id==='v2-user-{id}-profile'||r.endpoint_id==='v2-user-profile').map(row=>observedChoices([row],'player'))).slice(0,30)},
  {label:'My faction',options:observedChoices(rows.filter(r=>r.endpoint_id.includes('faction')&&r.endpoint_id.includes('members')),'player')},
  {label:'My targets',options:mergeChoices((targets.data??[]).map(row=>({value:String(row.torn_player_id),label:`${row.player_name??'Player'} [${row.torn_player_id}]`})))},
  {label:'Other saved players',options:observedChoices(rows,'player')}
 ];
 const seen=new Set<string>();const filtered=groups.map(group=>({...group,options:searchChoices(group.options,search).filter(option=>{if(seen.has(option.value))return false;seen.add(option.value);return true;})}));
 return <fieldset className="player-picker" disabled={disabled}><legend>{label}</legend><label htmlFor={id}>Search saved players<input id={id} className="nu-input" type="search" placeholder="Search name or ID…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
  <label>Choose player<select className="nu-input" value={value} onChange={e=>onChange(e.target.value)}><option value="">Choose…</option>{value&&!seen.has(value)&&<option value={value}>Selected: {value}</option>}{filtered.filter(g=>g.options.length).map(group=><optgroup key={group.label} label={group.label}>{group.options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>)}</select></label>
  <label>Player ID or Torn profile URL<input className="nu-input" inputMode="text" placeholder="Player ID or profiles.php URL" value={value} required={required} onChange={e=>onChange(playerInput(e.target.value))}/></label><small>Search uses saved players and makes no Torn API calls. Paste an ID to look up someone new.</small>
  {targets.isError&&<p role="status">Saved targets could not be loaded. You can still choose a cached player or paste an ID.</p>}
 </fieldset>;
}
