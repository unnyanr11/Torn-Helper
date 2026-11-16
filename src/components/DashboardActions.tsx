import {useQuery} from '@tanstack/react-query';
import {supabase} from '../lib/supabase';
import DataFreshness from './DataFreshness';
import {useEffect, useState} from 'react';
import {useWarTargets} from './WarTargetProvider';
import {useAccountTimers} from './TimerProvider';
import {NAV, type Page} from '../nav';
import {canAccessPage} from '../lib/access';

export default function DashboardActions({accountId}:{accountId?:string}) {
  const {claims, owner, error, list} = useWarTargets();
  const timers = useAccountTimers();
  const alerts=useQuery({
    queryKey:['dashboard-alerts',accountId],enabled:!!accountId,staleTime:30000,retry:false,
    queryFn:async()=>{
      const [events,unread]=await Promise.all([
        supabase.from('notification_events').select('id,message,created_at').eq('user_id',accountId!).order('created_at',{ascending:false}).limit(3),
        supabase.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',accountId!).eq('read',false),
      ]);
      if(events.error)throw events.error;
      if(unread.error)throw unread.error;
      return {events:events.data??[],unread:unread.count??0};
    },
  });
  const [now, setNow] = useState(Date.now);
  const [favourites, setFavourites] = useState<Page[]>([]);
  useEffect(() => {
    const read = () => {
      try {
        const stored = JSON.parse(localStorage.getItem(`tcc-navigation:${accountId ?? 'signed-out'}`) ?? '{}');
        setFavourites(Array.isArray(stored.favourites) ? stored.favourites.filter((p:Page) => NAV.includes(p) && canAccessPage(p,true,'user')) : []);
      } catch { setFavourites([]); }
    };
    read();
    window.addEventListener('torn:navigation-change',read);
    const timer=setInterval(()=>setNow(Date.now()),1000);
    return()=>{clearInterval(timer);window.removeEventListener('torn:navigation-change',read);};
  },[accountId]);
  const mine=claims.filter(c=>c.user_id===owner && Date.parse(c.expires_at)>now);
  return <section className="card" aria-label="Claims and alerts">
    <h3>Claims and alerts</h3>
    <p><a href="#War Room">{mine.length} active war claims</a> · <a href="#Alerts">Manage alerts</a></p>
    {mine.map(c=><p key={c.claim_id}>{list?.targets.find(t=>t.id===c.target_id)?.name ?? `Target ${c.target_id}`} · {Math.max(0,c.attacks_goal-c.attacks_done)} attacks remaining · reservation ends {new Date(c.expires_at).toLocaleTimeString()}</p>)}
    {(error||timers.error)&&<p role="status">Some claim or timer updates could not be checked. Open the affected tool to refresh.</p>}
    {alerts.data&&<><p><a href="#Notifications">{alerts.data.unread} unread notifications</a></p>
      {alerts.data.events.map(event=><p key={event.id}>{event.message} <small>· {new Date(event.created_at).toLocaleString()}</small></p>)}
      <DataFreshness at={alerts.dataUpdatedAt?new Date(alerts.dataUpdatedAt).toISOString():null} source="Saved alerts" busy={alerts.isFetching} error={alerts.isError}/>
    </>}
    {alerts.isError&&<p role="status">Alerts could not be checked.</p>}
    <button className="nu-btn" disabled={alerts.isFetching} onClick={()=>void alerts.refetch()}>Refresh alerts</button>
    <details><summary>Favourite tools</summary>
      {favourites.length ? <div className="intel-actions">{favourites.map(p=><a key={p} className="nu-btn" href={`#${p}`}>{p}</a>)}</div>
      : <p>Use the star beside a tool in the navigation menu to add it here.</p>}
    </details>
  </section>;
}
