import { useEffect,useRef,useState } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useTornConnection } from '../hooks/useTornConnection';
import { invokeTornData } from '../lib/torn-data-client';
import { functionError } from '../lib/function-error';
import TornConnectionPanel from './TornConnectionPanel';
import { BATTLE_STATS,battleGrowth,filterSharedMembers,formatBattleValue,type FactionBattleDashboard,type BattleSnapshot,type BattleLogSync } from '../lib/faction-battle-stats';
const label=(stat:string)=>stat==='defense'?'Defence':stat[0].toUpperCase()+stat.slice(1);
export default function FactionBattleStats(){
 const client=useQueryClient(),connection=useTornConnection(),owner=connection.owner;
 const [chosenMode,setMode]=useState<string|null>(null),[key,setKey]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [tab,setTab]=useState('leader'),[days,setDays]=useState(30),[filter,setFilter]=useState('all'),[sort,setSort]=useState('strength'),[memberId,setMemberId]=useState(''),[now,setNow]=useState(Date.now);
 const pending=useRef<AbortController|null>(null);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),15000);return()=>{clearInterval(timer);pending.current?.abort();};},[]);
 const mode=chosenMode??(connection.status.data?.hasStoredKey?'stored':'request');
 const ready=!!owner&&(mode==='stored'?connection.status.data?.hasStoredKey!==false:/^[A-Za-z0-9]{16}$/.test(key));
 const sharing=useQuery<{enabled:boolean;faction_id?:number;latest?:BattleSnapshot;log_sync?:BattleLogSync;automatic?:{enabled:boolean;key_saved:boolean;last_sync_at:string|null;next_sync_at:string;error:string|null}}>({queryKey:['my-faction-battle-sharing',owner],enabled:!!owner,retry:false,staleTime:30000,refetchInterval:60000,refetchIntervalInBackground:false,queryFn:async()=>{const r=await supabase.rpc('my_faction_battle_sharing');if(r.error)throw r.error;return r.data;}});
 useEffect(()=>{setConsent(!!sharing.data?.automatic?.enabled);},[sharing.data?.automatic?.enabled]);
 const dashboard=useQuery<FactionBattleDashboard>({queryKey:['faction-battle-dashboard',owner,days],enabled:!!owner&&tab==='leader',retry:false,staleTime:30000,refetchInterval:60000,refetchIntervalInBackground:false,queryFn:async()=>{const r=await supabase.rpc('faction_battle_dashboard',{window_days:days});if(r.error)throw r.error;return r.data;}});
 async function run(action:'leader'|'share'|'stop'){
  if(pending.current||(action==='leader'||action==='share'&&!sharing.data?.enabled)&&!ready)return;
  const controller=new AbortController();pending.current=controller;setBusy(true);setError('');setMessage('');const secret=mode==='request'?key:undefined;setKey('');
  try{
   if(action!=='stop'){
    const endpoints=action==='leader'?['v2-user-faction','v2-faction-basic','v2-faction-members']:sharing.data?.enabled?[]:['v2-user-faction','v2-user-battlestats'];
    for(const endpoint_id of endpoints){const r=await invokeTornData(client,{body:{endpoint_id,parameters:{},...(secret?{apiKey:secret}:{})},signal:controller.signal});if(r.error||r.data?.error)throw await functionError(r.data,r.error);}
   }
   if(controller.signal.aborted)return;
   const auth=await supabase.auth.getSession();if(auth.data.session?.user.id!==owner)throw new Error('Your account changed. Reload this page.');
   if(action==='leader'){
    const r=await supabase.rpc('faction_battle_dashboard',{window_days:days});if(r.error)throw r.error;
    if(controller.signal.aborted)return;client.setQueryData(['faction-battle-dashboard',owner,days],r.data);setNow(Date.now());setMessage('Faction leadership and roster checked. Showing only consenting current members.');
   }else{
    if(action==='stop'||!sharing.data?.enabled){const r=await supabase.rpc('set_faction_battle_sharing',{enabled:action==='share'});if(r.error)throw r.error;}
    if(action==='share'){const automatic=await supabase.rpc('enable_automatic_faction_stats');if(automatic.error)throw automatic.error;}
    await Promise.all([client.invalidateQueries({queryKey:['my-faction-battle-sharing',owner]}),client.invalidateQueries({queryKey:['faction-battle-dashboard',owner]})]);
    setMessage(action==='stop'?'Sharing stopped. Shared snapshots have been deleted.':'Automatic backend tracking is enabled. The saved baseline will be updated from logs and reconciled when needed.');
   }
  }catch(e){if(!controller.signal.aborted){if(action==='leader')client.removeQueries({queryKey:['faction-battle-dashboard',owner]});setError(e instanceof Error?e.message:typeof (e as any)?.message==='string'?(e as any).message:'Unable to update faction stats.');}}
  finally{if(pending.current===controller){pending.current=null;setBusy(false);}}
 }
 const verified=!!dashboard.data&&!dashboard.isError&&Date.parse(dashboard.data.expires_at)>now;
 const members=verified?dashboard.data!.members:[],visible=filterSharedMembers(members,filter,sort,memberId,now),shared=members.filter(m=>m.latest).length;
 return <article className="card faction-battle-stats"><h2>Faction battle stats</h2><p>Track only Strength, Defence, Speed and Dexterity for your faction. Each member must sign in with their own Torn key and opt in below. Your leader key cannot read another member’s private battle stats.</p>
  <div className="intel-tabs" role="group" aria-label="Faction stats views">{[['leader','Leader dashboard'],['sharing','My sharing']].map(([id,title])=><button type="button" className="nu-btn" key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{title}</button>)}</div>
  {(tab==='leader'||!sharing.data?.enabled)&&<TornConnectionPanel mode={mode} onMode={setMode} keyValue={key} onKey={setKey} disabled={busy}/>}
  {tab==='sharing'?<><h3>Share my four battle stats</h3><p>Only your current faction’s verified leader and co-leader can view these shared snapshots. Sharing does not grant access to money, inventory, logs or your API key. Shared snapshots are stored until you stop sharing, an observed faction departure or account deletion. Automatic tracking requires an encrypted Full Access key saved in Settings. The backend privately processes your logs; your leaders receive only the four stats and tracking status.</p>
   {!sharing.data?.automatic?.enabled&&<><label><input type="checkbox" checked={consent} disabled={busy||sharing.isPending} onChange={e=>setConsent(e.target.checked)}/> I agree to share these four stats with my faction’s leader/co-leader and allow private backend log processing to keep them updated.</label>
   <button type="button" className="nu-btn" disabled={busy||(!sharing.data?.enabled&&!ready)||!consent||sharing.isPending||sharing.isError} onClick={()=>void run('share')}>{busy?'Enabling…':'Enable automatic stat tracking'}</button></>}
   {sharing.data?.enabled&&<button type="button" className="nu-btn" disabled={busy} onClick={()=>void run('stop')}>Stop sharing & delete shared history</button>}
   {sharing.isError&&<p role="alert">Sharing status could not be loaded. <button type="button" className="nu-btn" onClick={()=>void sharing.refetch()}>Retry sharing status</button></p>}
   {sharing.data?.enabled&&<p>Sharing enabled for faction #{sharing.data.faction_id}. Last shared: {sharing.data.latest?new Date(sharing.data.latest.observed_at).toLocaleString():'No snapshot yet'}.</p>}
   {sharing.data?.automatic?.enabled&&<p role="status">Backend updates run automatically, normally about every five minutes while a saved key is available; busy queues and API limits can delay them. No manual log-sync action is needed.</p>}
   {sharing.data?.automatic&&!sharing.data.automatic.key_saved&&<p role="status">Save an encrypted Full Access Torn key in Settings so automatic updates can run while you are away.</p>}
   {sharing.data?.automatic?.error&&<p role="status">{sharing.data.automatic.error}</p>}
   {sharing.data?.log_sync&&<p>Logs checked through {new Date(sharing.data.log_sync.checked_through*1000).toLocaleString()}. {sharing.data.log_sync.reason?'The backend will reconcile a fresh snapshot because: '+sharing.data.log_sync.reason:'Only explicit numeric changes are applied.'}</p>}
   <p>A confirmed baseline is collected once, then changes are calculated from logs on the server. Unknown changes, long or incomplete log histories and weekly reconciliation trigger a fresh baseline automatically. Log-derived values are estimates; logs and rounded baselines can omit detail. Sharing stops when a refreshed faction record shows you left.</p>
  </>:<><button type="button" className="nu-btn" disabled={busy||!ready} onClick={()=>void run('leader')}>{busy?'Checking faction…':'Verify my faction & refresh stats'}</button><p>Only the leader/co-leader IDs returned by Torn grant access. A manually entered role does not. Verification lasts five minutes; refresh to check roster or leadership changes.</p>
   {dashboard.isPending&&<p role="status">Checking saved faction verification…</p>}
   {dashboard.error&&<p role="status">{(dashboard.error as any).message}</p>}
   {!verified&&dashboard.data&&<p role="status">Faction verification expired or could not be confirmed. Refresh above to view shared stats again.</p>}
   {verified&&<><h3>{dashboard.data!.faction_name} · #{dashboard.data!.faction_id}</h3><p>{shared} of {members.length} roster members have shared stats. Unshared values stay unknown. Roster/leadership checked {new Date(dashboard.data!.verified_at).toLocaleString()}.</p>
    <div className="travel-fields"><label>Member<select className="nu-input" value={memberId} onChange={e=>setMemberId(e.target.value)}><option value="">All current members</option>{members.map(m=><option key={m.id} value={String(m.id)}>{m.name} [{m.id}]</option>)}</select></label><label>Show<select className="nu-input" value={filter} onChange={e=>setFilter(e.target.value)}>{[['all','All members'],['shared','Stats shared'],['missing','Not shared yet'],['stale','Last update over 24 hours ago']].map(([id,title])=><option key={id} value={id}>{title}</option>)}</select></label><label>Sort<select className="nu-input" value={sort} onChange={e=>setSort(e.target.value)}><option value="name">Name</option>{BATTLE_STATS.map(stat=><option key={stat} value={stat}>Highest {label(stat)}</option>)}</select></label><label>Growth window<select className="nu-input" value={days} onChange={e=>setDays(Number(e.target.value))}>{[7,30,90].map(d=><option key={d} value={d}>{d} days</option>)}</select></label></div>
    <div className="table-scroll"><table><thead><tr><th>Member</th>{BATTLE_STATS.map(stat=><th key={stat}>{label(stat)}</th>)}<th>Last shared</th></tr></thead><tbody>{visible.map(m=><tr key={m.id}><td>{m.name}<br/><small>#{m.id}</small>{m.latest?.source==='log_estimate'&&<><br/><small>Log-derived estimate</small></>}{m.log_sync?.reason&&<><br/><small>Reconciliation pending</small></>}</td>{BATTLE_STATS.map(stat=><td key={stat}>{formatBattleValue(m.latest?.[stat])}{m.latest&&<><br/><small>{battleGrowth(m,stat)??'Growth unknown · needs two snapshots'}</small></>}</td>)}<td>{m.latest?<>{new Date(m.latest.observed_at).toLocaleString()}{m.log_sync&&<><br/><small>Logs through {new Date(m.log_sync.checked_through*1000).toLocaleString()}</small></>}{now-Date.parse(m.latest.observed_at)>86400000&&<small> · Older than 24 hours</small>}{m.baseline&&m.baseline.observed_at!==m.latest.observed_at&&<><br/><small>Growth from {new Date(m.baseline.observed_at).toLocaleString()}</small></>}</>:'Not shared'}</td></tr>)}</tbody></table></div>
    {!visible.length&&<p>No members match these filters.</p>}<p>Growth compares the earliest and latest shared snapshots within the selected window. Collection starts when members opt in; there is no backfill. The backend calculates log-based estimates automatically and reconciles snapshots when needed.</p>
   </>}
  </>}
  {!ready&&(tab==='leader'||!sharing.data?.enabled)&&<p role="status">{!owner?'Checking your account…':mode==='stored'?'No saved key is available. Choose a request-only key or save one in Settings.':'Enter your own request-only Torn key above to refresh.'}</p>}
  {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
 </article>;
}
