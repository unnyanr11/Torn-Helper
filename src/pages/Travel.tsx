import { useEffect,useState } from 'react';
import TravelProfitTool from '../components/TravelProfitTool';
import { supabase } from '../lib/supabase';
export default function Travel(){
 const [observations,setObservations]=useState<{id:string;destination:string;item_name:string|null;price:string|null;observed_at:string}[]>([]);
 useEffect(()=>{let alive=true;void supabase.from('travel_observations').select('id,destination,item_name,price,observed_at').order('observed_at',{ascending:false}).limit(50).then(r=>{if(alive&&!r.error)setObservations(r.data??[]);});return()=>{alive=false;};},[]);
 return <><TravelProfitTool/>{!!observations.length&&<details className="card"><summary>Previous manual price observations</summary><div className="table-scroll"><table><thead><tr><th>Location</th><th>Item</th><th>Manual price</th><th>Recorded</th></tr></thead><tbody>{observations.map(o=><tr key={o.id}><td>{o.destination}</td><td>{o.item_name}</td><td>{o.price}</td><td>{new Date(o.observed_at).toLocaleString()}</td></tr>)}</tbody></table></div></details>}</>;
}
