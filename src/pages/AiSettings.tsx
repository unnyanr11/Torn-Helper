import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AiSettings() {
  const [openaiKey, setOpenaiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('encrypted_credentials')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'openai')
      .maybeSingle();
    setHasKey(!!data);
  }

  async function saveKey() {
    setError(''); setSuccess('');
    if (!openaiKey.trim().startsWith('sk-')) {
      setError('Enter a valid OpenAI API key (starts with sk-)');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Call Edge Function to encrypt + store (never send raw key to client-side storage)
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/link-openai-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      },
      body: JSON.stringify({ openai_key: openaiKey.trim() }),
    });
    const json = await res.json();
    if (json.error) {
      setError(json.error);
    } else {
      setSuccess('OpenAI key linked — Torn Analyzer AI mode unlocked');
      setOpenaiKey('');
      setHasKey(true);
    }
  }

  async function removeKey() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('encrypted_credentials')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'openai');
    setHasKey(false);
    setSuccess('OpenAI key removed — AI mode locked');
  }

  return (
    <section>
      <h2>AI Settings</h2>
      <p className="muted">Link your own OpenAI API key to unlock the AI-powered Torn Analyzer. Your key is encrypted server-side and never exposed to the client.</p>
      {error && <p className="badge warn">{error}</p>}
      {success && <p className="badge ok">{success}</p>}

      <article className="card nu-inset">
        <h3>OpenAI API Key</h3>
        {hasKey ? (
          <div>
            <p className="badge ok">Key linked — AI mode unlocked</p>
            <button className="nu-btn" onClick={removeKey}>Remove key</button>
          </div>
        ) : (
          <div>
            <p className="muted">No key linked — AI mode locked (rules-based analyzer only)</p>
            <input
              className="nu-input"
              type="password"
              placeholder="sk-..."
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
            />
            <button className="nu-btn" onClick={saveKey}>Link key</button>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Your key is encrypted with AES-GCM server-side and used only to call OpenAI on your behalf. It is never logged, shared, or exposed to the browser.
            </p>
          </div>
        )}
      </article>
    </section>
  );
}
