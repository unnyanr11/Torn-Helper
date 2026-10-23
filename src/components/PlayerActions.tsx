import { useEffect,useState } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useTornConnection } from '../hooks/useTornConnection';
export default function PlayerActions({player,owner}:{player:Record<string,any>;owner:string}){
 const client=useQueryClient(),connection=useTornConnection(),[list,setList]=useState(''),[notes,setNotes]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const lists=useQuery({queryKey:['intel-target-lists',owner],queryFn:async()=>{const r=await supabase.from('target_lists').select('id,name').eq('user_id',owner).order('created_at');if(r.error)throw r.error;return r.data;}});
 const active=list||lists.data?.[0]?.id||'';
 const entry=useQuery({queryKey:['intel-target-entry',owner,active,player.id],enabled:!!active,staleTime:60000,refetchOnWindowFocus:false,queryFn:async()=>{const r=await supabase.from('target_list_entries').select('id,notes').eq('list_id',active).eq('torn_player_id',player.id).maybeSingle();if(r.error)throw r.error;return r.data;}});
 useEffect(()=>{setNotes(entry.data?.notes??'');setMessage('');},[entry.data,active,player.id]);
 async function save(){
  setBusy(true);setMessage('');
  try{
   const auth=await supabase.auth.getSession();if(auth.data.session?.user.id!==owner)throw new Error('Your account changed. Reload this page.');
   let listId=active;if(!listId){const r=await supabase.from('target_lists').insert({user_id:owner,name:'My targets',mode:'levelling'}).select('id').single();if(r.error)throw r.error;listId=r.data.id;setList(listId);}
   // Preserve existing target flags/status; do not upsert a whole cached profile over user edits.
   let r;if(entry.data?.id)r=await supabase.from('target_list_entries').update({notes}).eq('id',entry.data.id).eq('list_id',listId);
   else r=await supabase.from('target_list_entries').insert({list_id:listId,torn_player_id:player.id,player_name:player.name,level:player.level??null,notes});
   if(r.error)throw r.error;
   await Promise.all([client.invalidateQueries({queryKey:['intel-target-lists',owner]}),client.invalidateQueries({queryKey:['intel-target-entry',owner]}),client.invalidateQueries({queryKey:['player-picker-targets',owner]}),client.invalidateQueries({queryKey:['target-entries']}),client.invalidateQueries({queryKey:['target-lists']})]);setMessage('Target and notes saved.');
  }catch(e){setMessage(e instanceof Error?e.message:'Unable to save target.');}finally{setBusy(false);}
 }
 const self=connection.status.data?.identity?.torn_id,ids=self&&Number(self)!==Number(player.id)?`${self},${player.id}`:String(player.id);
 return <article className="card player-actions"><h3>Player actions</h3><div className="intel-actions"><a className="nu-btn" href={`#Compare%20Players?players=${encodeURIComponent(ids)}`}>Compare player</a><a className="nu-btn" href={`https://www.torn.com/page.php?sid=attack&user2ID=${player.id}`} target="_blank" rel="noopener noreferrer">Attack on Torn ↗</a></div><details><summary>Add to target list / private notes</summary>
 <label>Target list<select className="nu-input" value={active} disabled={busy||lists.isPending} onChange={e=>setList(e.target.value)}>{!lists.data?.length&&<option value="">Create My targets</option>}{lists.data?.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label>Private notes<textarea className="nu-input" value={notes} maxLength={4000} disabled={entry.isPending&&!!active||busy} onChange={e=>setNotes(e.target.value)}/></label>
 <button type="button" className="nu-btn" disabled={busy||lists.isPending||lists.isError||!!active&&(entry.isPending||entry.isError)} onClick={()=>void save()}>{busy?'Saving…':entry.data?'Save private notes':'Add to target list & save notes'}</button>
 {(lists.error||entry.error)&&<p role="alert">Unable to load target lists or notes. Try again before saving.</p>}{message&&<p role="status">{message}</p>}
 </details></article>;
}
