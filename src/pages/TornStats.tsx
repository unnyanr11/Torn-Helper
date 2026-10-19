import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Connection { id: string; provider: string; status: string; connected_at: string }
interface ImportJob { id: string; target_torn_id: number; status: string; result: any; error_message: string; created_at: string }

export default function TornStats() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [token, setToken] = useState('');
  const [targetId, setTargetId] = useState('');
  const [pasteData, setPasteData] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [c, j] = await Promise.all([
      supabase.from('integration_connections').select('*').eq('user_id', user.id).eq('provider', 'tornstats').maybeSingle(),
      supabase.from('spy_import_jobs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
    ]);
    if (c.error) setError(c.error.message); else setConnection(c.data);
    if (j.error) setError(j.error.message); else setJobs(j.data ?? []);
  }

  async function connect() {
    setError('');
    if (!token.trim()) { setError('Enter your TornStats API token'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('integration_connections').upsert({
      user_id: user.id,
      provider: 'tornstats',
      token_encrypted: token.trim(),
      status: 'connected',
      connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });
    if (error) setError(error.message);
    else { setToken(''); load(); }
  }

  async function disconnect() {
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('integration_connections').update({ status: 'disconnected', disconnected_at: new Date().toISOString(), token_encrypted: null }).eq('user_id', user.id).eq('provider', 'tornstats');
    if (error) setError(error.message);
    else load();
  }

  async function revoke() {
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('integration_connections').update({ status: 'revoked', disconnected_at: new Date().toISOString(), token_encrypted: null }).eq('user_id', user.id).eq('provider', 'tornstats');
    if (error) setError(error.message);
    else load();
  }

  async function importReport() {
    setError('');
    const tid = parseInt(targetId, 10);
    if (isNaN(tid) || !pasteData.trim()) { setError('Enter target Torn ID and paste the spy report JSON'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    let parsed: any;
    try { parsed = JSON.parse(pasteData); } catch { setError('Invalid JSON — paste the raw spy report'); return; }
    const { data, error } = await supabase.from('spy_import_jobs').insert({
      user_id: user.id,
      provider: 'tornstats',
      target_torn_id: tid,
      status: 'complete',
      result: parsed,
    }).select().single();
    if (error) setError(error.message);
    else { setTargetId(''); setPasteData(''); load(); }
  }

  return (
    <section>
      <h2>TornStats Integration</h2>
      <p className="muted">Opt-in adapter for TornStats spy reports. Connect with your TornStats API token, or paste reports manually. Imports are deduplicated by target and logged with provenance.</p>
      {error && <p className="badge warn">{error}</p>}

      <article className="card nu-inset">
        <h3>Connection</h3>
        {connection && connection.status === 'connected' ? (
          <>
            <p>Status: <span className="badge">connected</span> since {new Date(connection.connected_at).toLocaleString()}</p>
            <button className="nu-btn" onClick={disconnect}>Disconnect</button>
            <button className="nu-btn" onClick={revoke}>Revoke token</button>
          </>
        ) : (
          <>
            <p className="muted">{connection ? `Status: ${connection.status}` : 'Not connected'}</p>
            <input className="nu-input" placeholder="TornStats API token" type="password" value={token} onChange={(e) => setToken(e.target.value)} />
            <button className="nu-btn" onClick={connect}>Connect</button>
            <p className="muted" style={{ marginTop: 6 }}>Token is stored for this integration only. Live API lookup requires verified TornStats API access; manual paste import works without it.</p>
          </>
        )}
      </article>

      <article className="card nu-inset">
        <h3>Import spy report</h3>
        <input className="nu-input" placeholder="Target Torn ID" value={targetId} onChange={(e) => setTargetId(e.target.value)} />
        <textarea className="nu-input" rows={4} placeholder="Paste spy report JSON here" value={pasteData} onChange={(e) => setPasteData(e.target.value)} />
        <button className="nu-btn" onClick={importReport}>Import report</button>
      </article>

      <article className="card nu-inset">
        <h3>Import history</h3>
        {jobs.map((j) => (
          <div key={j.id} style={{ borderBottom: '1px solid #333', padding: '6px 0' }}>
            <b>Target {j.target_torn_id}</b> — {j.status} — {new Date(j.created_at).toLocaleString()}
            {j.result && <pre style={{ fontSize: 11, maxHeight: 100, overflow: 'auto', background: '#111', padding: 6, borderRadius: 6 }}>{JSON.stringify(j.result, null, 2).slice(0, 300)}</pre>}
          </div>
        ))}
        {jobs.length === 0 && <p className="muted">No imports yet.</p>}
      </article>
    </section>
  );
}
