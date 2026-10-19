import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Holding { id: string; stock_id: string; shares: string; avg_cost: string | null; }

export default function Stocks() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [stockId, setStockId] = useState('');
  const [shares, setShares] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase.from('stock_holdings').select('*').order('stock_id');
    if (error) setError(error.message);
    else setHoldings(data ?? []);
  }

  async function addHolding() {
    if (!stockId.trim() || !shares) { setError('Enter stock ID and shares'); return; }
    const { error } = await supabase.from('stock_holdings').upsert({
      stock_id: stockId.trim(),
      shares,
      avg_cost: avgCost || null,
    }, { onConflict: 'user_id,stock_id' });
    if (error) setError(error.message);
    else { setStockId(''); setShares(''); setAvgCost(''); load(); }
  }

  async function removeHolding(id: string) {
    const { error } = await supabase.from('stock_holdings').delete().eq('id', id);
    if (error) setError(error.message);
    else load();
  }

  return (
    <section>
      <h2>Stocks</h2>
      <p className="muted">Manual holdings tracker. Live prices and benefit valuations require a verified data source and are not implemented yet.</p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>Add / update holding</h3>
        <input className="nu-input" placeholder="Stock ID (e.g. TCP)" value={stockId} onChange={(e) => setStockId(e.target.value)} />
        <input className="nu-input" placeholder="Shares" value={shares} onChange={(e) => setShares(e.target.value)} />
        <input className="nu-input" placeholder="Average cost (optional)" value={avgCost} onChange={(e) => setAvgCost(e.target.value)} />
        <button className="nu-btn" onClick={addHolding}>Save holding</button>
      </article>
      <div className="grid">
        {holdings.map((h) => (
          <article key={h.id} className="card nu-raised">
            <h3>{h.stock_id}</h3>
            <p className="value">{h.shares}</p>
            {h.avg_cost && <p className="muted">Avg cost: {h.avg_cost}</p>}
            <button className="nu-btn" onClick={() => removeHolding(h.id)}>Remove</button>
          </article>
        ))}
        {holdings.length === 0 && <p className="muted">No holdings yet.</p>}
      </div>
    </section>
  );
}
