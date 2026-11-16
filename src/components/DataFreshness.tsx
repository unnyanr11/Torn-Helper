import { useEffect, useState } from 'react';

export default function DataFreshness({at, source, busy=false, error=false}: {at?:string|null; source:string; busy?:boolean; error?:boolean}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const timestamp = at ? Date.parse(at) : NaN;
  const age = Math.max(0, Math.floor((now - timestamp) / 60000));
  const label = !Number.isFinite(timestamp) ? 'Collection time unavailable'
    : age < 1 ? 'Updated just now' : age < 60 ? `Updated ${age} minutes ago`
    : age < 1440 ? `Updated ${Math.floor(age / 60)} hours ago` : `Updated ${Math.floor(age / 1440)} days ago`;
  return <p className="muted data-freshness" title={Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : undefined}>
    {label} · {source}{busy ? ' · Refreshing…' : error ? ' · Refresh failed; saved data shown when available' : ''}
  </p>;
}
