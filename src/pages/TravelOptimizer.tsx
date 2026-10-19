import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Scenario { id: string; destination: string; item_name: string; buy_price: number; sell_price: number; quantity: number; travel_cost: number; flight_minutes: number; profit_total: number; profit_per_hour: number }

const DESTINATIONS = ['Mexico', 'Cayman Islands', 'Canada', 'Hawaii', 'United Kingdom', 'Argentina', 'Switzerland', 'Japan', 'China', 'UAE', 'South Africa', 'Morocco'];

export default function TravelOptimizer() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [error, setError] = useState('');
  const [destination, setDestination] = useState('Mexico');
  const [item, setItem] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [qty, setQty] = useState('');
  const [travelCost, setTravelCost] = useState('0');
  const [flightMin, setFlightMin] = useState('30');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from('travel_profit_scenarios').select('*').eq('user_id', user.id).order('profit_per_hour', { ascending: false }).limit(50);
    if (error) setError(error.message); else setScenarios(data ?? []);
  }

  async function addScenario() {
    setError('');
    const buy = parseFloat(buyPrice); const sell = parseFloat(sellPrice); const q = parseInt(qty, 10); const tc = parseFloat(travelCost) || 0; const fm = parseInt(flightMin, 10) || 0;
    if (!item.trim() || isNaN(buy) || buy < 0 || isNaN(sell) || sell < 0 || isNaN(q) || q <= 0) { setError('Fill item, buy/sell price, and valid quantity'); return; }
    const profit = (sell - buy) * q - tc;
    const pph = fm > 0 ? (profit / fm) * 60 : 0;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('travel_profit_scenarios').insert({ user_id: user.id, destination, item_name: item.trim(), buy_price: buy, sell_price: sell, quantity: q, travel_cost: tc, flight_minutes: fm, profit_total: profit, profit_per_hour: pph });
    if (error) setError(error.message);
    else { setItem(''); setBuyPrice(''); setSellPrice(''); setQty(''); load(); }
  }

  async function removeScenario(id: string) {
    await supabase.from('travel_profit_scenarios').delete().eq('id', id);
    load();
  }

  const best = scenarios[0];

  return (
    <section>
      <h2>Travel Profit Optimizer</h2>
      <p className="muted">Compare buy/sell opportunities across destinations. Enter observed prices (manual or from market snapshots); the app ranks scenarios by profit per hour of flight time.</p>
      {error && <p className="badge warn">{error}</p>}

      {best && (
        <article className="card nu-inset">
          <h3>Best route: {best.destination} — {best.item_name}</h3>
          <p><b>Profit:</b> ${best.profit_total.toLocaleString()} • <b>Per hour:</b> ${best.profit_per_hour.toLocaleString()}/hr</p>
        </article>
      )}

      <article className="card nu-inset">
        <h3>New scenario</h3>
        <select className="nu-input" value={destination} onChange={(e) => setDestination(e.target.value)}>
          {DESTINATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <input className="nu-input" placeholder="Item name" value={item} onChange={(e) => setItem(e.target.value)} />
        <input className="nu-input" type="number" placeholder="Buy price ($/unit)" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} />
        <input className="nu-input" type="number" placeholder="Sell price ($/unit)" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
        <input className="nu-input" type="number" min="1" placeholder="Quantity" value={qty} onChange={(e) => setQty(e.target.value)} />
        <input className="nu-input" type="number" min="0" placeholder="Travel cost ($, optional)" value={travelCost} onChange={(e) => setTravelCost(e.target.value)} />
        <input className="nu-input" type="number" min="0" placeholder="Flight time (minutes)" value={flightMin} onChange={(e) => setFlightMin(e.target.value)} />
        <button className="nu-btn" onClick={addScenario}>Add scenario</button>
        <p className="muted" style={{ marginTop: 6 }}>Profit = (sell − buy) × qty − travel cost. Per-hour = profit ÷ flight time × 60.</p>
      </article>

      <div className="grid">
        {scenarios.map((s) => (
          <article key={s.id} className="card nu-inset">
            <h3>{s.destination} — {s.item_name}</h3>
            <p>Buy ${s.buy_price.toLocaleString()} → Sell ${s.sell_price.toLocaleString()} × {s.quantity}</p>
            <p><b>Profit:</b> ${s.profit_total.toLocaleString()}</p>
            <p><b>Per hour:</b> ${s.profit_per_hour.toLocaleString()}/hr ({s.flight_minutes} min flight)</p>
            <button className="nu-btn" onClick={() => removeScenario(s.id)}>Delete</button>
          </article>
        ))}
        {scenarios.length === 0 && <p className="muted">No scenarios yet.</p>}
      </div>
    </section>
  );
}
