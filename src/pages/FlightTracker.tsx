import SelectEntry from "../components/SelectEntry";
import { ROUTES } from "../lib/travel-profit";
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Flight { id: string; destination: string; departed_at: string; arrives_at: string; status: string; notes: string }

export default function FlightTracker() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [destination, setDestination] = useState('');
  const [departs, setDeparts] = useState('');
  const [arrives, setArrives] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase.from('flight_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) setError(error.message);
    else setFlights(data ?? []);
  }

  async function add() {
    setError('');
    if (!destination.trim() || !departs || !arrives) { setError('Enter destination, departure, and arrival times'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('flight_logs').insert({ user_id: user.id, destination: destination.trim(), departed_at: departs, arrives_at: arrives });
    if (error) setError(error.message);
    else { setDestination(''); setDeparts(''); setArrives(''); load(); }
  }

  async function setStatus(f: Flight, status: string) {
    await supabase.from('flight_logs').update({ status }).eq('id', f.id);
    load();
  }

  async function remove(f: Flight) {
    await supabase.from('flight_logs').delete().eq('id', f.id);
    load();
  }

  return (
    <section>
      <h2>Flight Tracker</h2>
      <p className="muted">Log flights (destination, departure, arrival) and track status. Owner-only data.</p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>Log flight</h3>
        <SelectEntry options={ROUTES.map(r=>({value:r.country,label:r.country}))} allowCustom={false} className="nu-input" placeholder="Destination" value={destination} onChange={(e) => setDestination(e.target.value)} />
        <label>Departure<input className="nu-input" type="datetime-local" value={departs} onChange={(e) => setDeparts(e.target.value)} /></label>
        <label>Arrival<input className="nu-input" type="datetime-local" value={arrives} onChange={(e) => setArrives(e.target.value)} /></label>
        <button className="nu-btn" onClick={add}>Log flight</button>
      </article>
      <div className="grid">
        {flights.map((f) => (
          <article key={f.id} className="card nu-inset">
            <h3>{f.destination}</h3>
            <p className="muted">{new Date(f.departed_at).toLocaleString()} → {new Date(f.arrives_at).toLocaleString()}</p>
            <span className="badge">{f.status}</span>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {['in_flight', 'arrived', 'returned'].filter((s) => s !== f.status).map((s) => (
                <button key={s} className="nu-btn" onClick={() => setStatus(f, s)}>Mark {s}</button>
              ))}
              <button className="nu-btn" onClick={() => remove(f)}>Delete</button>
            </div>
          </article>
        ))}
        {flights.length === 0 && <p className="muted">No flights logged yet.</p>}
      </div>
    </section>
  );
}
