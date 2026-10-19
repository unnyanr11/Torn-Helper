import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AiWarAnalyzer() {
  const [consented, setConsented] = useState(false);
  const [evidence, setEvidence] = useState('');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('ai_consents').select('consented').eq('user_id', user.id).eq('provider', 'openai').maybeSingle();
    setConsented(data?.consented ?? false);
  }

  async function toggleConsent() {
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('ai_consents').upsert({ user_id: user.id, provider: 'openai', consented: !consented, updated_at: new Date().toISOString() }, { onConflict: 'user_id,provider' });
    if (error) setError(error.message);
    else { setConsented(!consented); load(); }
  }

  async function generateSummary() {
    setError(''); setSummary(''); setLoading(true);
    if (!evidence.trim()) { setError('Paste war evidence JSON first'); setLoading(false); return; }
    let parsed: any;
    try { parsed = JSON.parse(evidence); } catch { setError('Invalid JSON evidence'); setLoading(false); return; }
    const { data, error } = await supabase.functions.invoke('analyze-war-ai', { body: { evidence: parsed } });
    setLoading(false);
    if (error) setError(error.message);
    else setSummary(data.summary ?? '');
  }

  // Rules-based fallback (always available, no AI)
  function rulesBasedSummary() {
    if (!evidence.trim()) { setError('Paste war evidence JSON first'); return; }
    let parsed: any;
    try { parsed = JSON.parse(evidence); } catch { setError('Invalid JSON evidence'); return; }
    const hits = Array.isArray(parsed) ? parsed : (parsed.hits ?? []);
    const totalHits = hits.length;
    const byMember: Record<string, number> = {};
    hits.forEach((h: any) => { const k = h.member ?? h.attacker ?? 'unknown'; byMember[k] = (byMember[k] ?? 0) + 1; });
    const top = Object.entries(byMember).sort((a, b) => b[1] - a[1]).slice(0, 5);
    setSummary(`Rules-based summary (no AI): ${totalHits} hits recorded. Top contributors: ${top.map(([m, c]) => `${m} (${c})`).join(', ') || 'none'}. Anomalies: none flagged by heuristic.`);
  }

  return (
    <section>
      <h2>AI War Analyzer</h2>
      <p className="muted">Optional AI-powered summary of war evidence. Deterministic accounting and payout decisions always remain separate — AI provides recommendations only, never allocations or payment authorization.</p>
      {error && <p className="badge warn">{error}</p>}

      <article className="card nu-inset">
        <h3>AI consent</h3>
        <p>{consented ? 'Consent granted — war evidence may be sent to OpenAI for summarization.' : 'Consent not granted — AI features disabled. Rules-based summary remains available.'}</p>
        <button className="nu-btn" onClick={toggleConsent}>{consented ? 'Revoke consent' : 'Grant consent'}</button>
        <p className="muted" style={{ marginTop: 6 }}>Granting consent allows war evidence JSON to be sent to OpenAI (gpt-4o-mini) for analysis. No API keys or payout amounts are sent.</p>
      </article>

      <article className="card nu-inset">
        <h3>War evidence</h3>
        <textarea className="nu-input" rows={6} placeholder="Paste war evidence JSON (e.g. attack records, chain data)" value={evidence} onChange={(e) => setEvidence(e.target.value)} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          <button className="nu-btn" onClick={generateSummary} disabled={loading || !consented}>{loading ? 'Analyzing…' : 'Generate AI summary'}</button>
          <button className="nu-btn" onClick={rulesBasedSummary}>Rules-based summary (no AI)</button>
        </div>
      </article>

      {summary && (
        <article className="card nu-inset">
          <h3>Summary</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{summary}</p>
        </article>
      )}
    </section>
  );
}
