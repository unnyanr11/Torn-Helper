import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Usage { id: string; endpoint: string; cost_cents: number; created_at: string }

export default function AdminCostDashboard() {
  const [usage, setUsage] = useState<Usage[]>([]);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase.from('api_usage').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) setError(error.message);
    else setUsage(data ?? []);
  }

  const byEndpoint: Record<string, { calls: number; cost: number }> = {};
  usage.forEach((u) => {
    if (!byEndpoint[u.endpoint]) byEndpoint[u.endpoint] = { calls: 0, cost: 0 };
    byEndpoint[u.endpoint].calls += 1;
    byEndpoint[u.endpoint].cost += u.cost_cents ?? 0;
  });
  const totalCost = usage.reduce((s, u) => s + (u.cost_cents ?? 0), 0);

  return (
    <section>
      <h2>Admin Cost Dashboard</h2>
      <p className="muted">Aggregated API usage and estimated cost by endpoint (from api_usage logs). Read-only view.</p>
      {error && <p className="badge warn">{error}</p>}
      <div className="grid">
        <article className="card nu-raised"><h3>Total calls</h3><p>{usage.length}</p></article>
        <article className="card nu-raised"><h3>Total est. cost</h3><p>${(totalCost / 100).toFixed(2)}</p></article>
        <article className="card nu-raised"><h3>Endpoints used</h3><p>{Object.keys(byEndpoint).length}</p></article>
      </div>
      <article className="card nu-inset">
        <h3>By endpoint</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={{ textAlign: 'left' }}>Endpoint</th><th>Calls</th><th>Est. cost</th></tr></thead>
          <tbody>
            {Object.entries(byEndpoint).map(([ep, v]) => (
              <tr key={ep}><td style={{ textAlign: 'left' }}>{ep}</td><td style={{ textAlign: 'center' }}>{v.calls}</td><td style={{ textAlign: 'center' }}>${(v.cost / 100).toFixed(2)}</td></tr>
            ))}
          </tbody>
        </table>
        {Object.keys(byEndpoint).length === 0 && <p className="muted">No usage logged yet.</p>}
      </article>
    </section>
  );
}
