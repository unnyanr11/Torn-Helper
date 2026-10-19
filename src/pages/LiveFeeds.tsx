import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface FeedRow { feed_type: string; payload: unknown; fetched_at: string; }

const FEEDS = ['travel', 'market', 'stocks', 'company'] as const;

type FeedType = typeof FEEDS[number];

export default function LiveFeeds() {
  const [feeds, setFeeds] = useState<Record<string, FeedRow>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase.from('live_feed_cache').select('*');
    if (error) setError(error.message);
    else {
      const map: Record<string, FeedRow> = {};
      (data ?? []).forEach((r: FeedRow) => { map[r.feed_type] = r; });
      setFeeds(map);
    }
  }

  async function refresh(feed: FeedType) {
    setBusy(feed);
    setError('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('Not signed in'); setBusy(null); return; }
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refresh-live-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ feed_type: feed }),
    });
    const json = await resp.json();
    if (!resp.ok) setError(json.error ?? 'Refresh failed');
    await load();
    setBusy(null);
  }

  return (
    <section>
      <h2>Live Feeds</h2>
      <p className="muted">Refresh travel, market, stock, and company data from your linked Torn API key. Results are cached per feed type.</p>
      {error && <p className="badge warn">{error}</p>}
      <div className="grid">
        {FEEDS.map((feed) => {
          const row = feeds[feed];
          return (
            <article key={feed} className="card nu-raised">
              <h3 className="capitalize">{feed}</h3>
              {row ? (
                <>
                  <p className="muted">Last updated: {new Date(row.fetched_at).toLocaleString()}</p>
                  <pre className="nu-inset" style={{ maxHeight: 200, overflow: 'auto', fontSize: '0.75rem' }}>{JSON.stringify(row.payload, null, 2).slice(0, 2000)}</pre>
                </>
              ) : (
                <p className="muted">Not fetched yet.</p>
              )}
              <button className="nu-btn" disabled={busy === feed} onClick={() => refresh(feed)}>
                {busy === feed ? 'Refreshing…' : 'Refresh'}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
