import {useQuery} from '@tanstack/react-query';
import {supabase} from '../lib/supabase';
import {useCurrentObservations} from '../hooks/useSavedObservations';
export default function AdminAccountCard(){
 const {owner}=useCurrentObservations();
 const profile=useQuery({queryKey:['admin-account',owner],enabled:!!owner,retry:false,queryFn:async()=>{const r=await supabase.from('profiles').select('role').eq('id',owner!).maybeSingle();if(r.error)throw r.error;return r.data;}});
 if(profile.data?.role!=='admin')return null;
 return <article className="card"><h3>Administrator account</h3><p>You have website administrator access. Your Torn identity and game data can be linked separately below.</p><p><a href="#Travel">Review price update requests</a> in Travel → Request a price update / review submissions. Price approval requires the database-managed reviewer permission.</p><p><a href="#Admin%20Cost%20Dashboard">Open administrator cost dashboard</a></p></article>;
}
