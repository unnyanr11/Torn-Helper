import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AiSettings() {
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [provider, setProvider] = useState<'openai' | 'gemini'>('openai');
  const [hasKey, setHasKey] = useState<{ openai: boolean; gemini: boolean }>({ openai: false, gemini: false });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('encrypted_credentials')
      .select('provider')
      .eq('user_id', user.id);
    setHasKey({
      openai: data?.some((d) => d.provider === 'openai') ?? false,
      gemini: data?.some((d) => d.provider === 'gemini') ?? false,
    });
  }

  async function saveKey() {
    setError(''); setSuccess('');
    const key = provider === 'openai' ? openaiKey.trim() : geminiKey.trim();
    if (provider === 'openai' && !key.startsWith('sk-')) {
      setError('Enter a valid OpenAI API key (starts with sk-)');
      return;
    }
    if (provider === 'gemini' && !key.startsWith('AI')) {
      setError('Enter a valid Gemini API key (starts with AI)');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/link-ai-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      },
      body: JSON.stringify({ provider, api_key: key }),
    });
    const json = await res.json();
    if (json.error) {
      setError(json.error);
    } else {
      setSuccess(`${provider === 'openai' ? 'OpenAI' : 'Gemini'} key linked — Torn Analyzer AI mode unlocked`);
      if (provider === 'openai') setOpenaiKey(''); else setGeminiKey('');
      load();
    }
  }

  async function removeKey(prov: 'openai' | 'gemini') {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('encrypted_credentials')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', prov);
    setSuccess(`${prov === 'openai' ? 'OpenAI' : 'Gemini'} key removed`);
    load();
  }

  return (
    <section>
      <h2>AI Settings</h2>
      <p className="muted">Link your own OpenAI or Gemini API key to unlock the AI-powered Torn Analyzer. Keys are encrypted server-side and never exposed to the client.</p>
      {error && <p className="badge warn">{error}</p>}
      {success && <p className="badge ok">{success}</p>}

      <article className="card nu-inset">
        <h3>Choose provider</h3>
        <select className="nu-input" value={provider} onChange={(e) => setProvider(e.target.value as 'openai' | 'gemini')}>
          <option value="openai">OpenAI</option>
          <option value="gemini">Gemini</option>
        </select>
      </article>

      <article className="card nu-inset">
        <h3>{provider === 'openai' ? 'OpenAI' : 'Gemini'} API Key</h3>
        {hasKey[provider] ? (
          <div>
            <p className="badge ok">Key linked — AI mode unlocked</p>
            <button className="nu-btn" onClick={() => removeKey(provider)}>Remove key</button>
          </div>
        ) : (
          <div>
            <p className="muted">No key linked — AI mode locked (rules-based analyzer only)</p>
            <input
              className="nu-input"
              type="password"
              placeholder={provider === 'openai' ? 'sk-...' : 'AI...'}
              value={provider === 'openai' ? openaiKey : geminiKey}
              onChange={(e) => provider === 'openai' ? setOpenaiKey(e.target.value) : setGeminiKey(e.target.value)}
            />
            <button className="nu-btn" onClick={saveKey}>Link key</button>
            <button className="nu-btn" onClick={() => setShowHelp(!showHelp)} style={{ marginLeft: 8 }}>
              {showHelp ? 'Hide help' : 'How do I get a key?'}
            </button>
            {showHelp && (
              <div style={{ marginTop: 12, padding: 12, background: '#222', borderRadius: 8, fontSize: 13 }}>
                {provider === 'openai' ? (
                  <>
                    <strong>Getting an OpenAI API key:</strong>
                    <ol style={{ paddingLeft: 20, marginTop: 8 }}>
                      <li>Go to <a href="https://platform.openai.com/signup" target="_blank" rel="noopener noreferrer">platform.openai.com/signup</a> and create an account (or log in).</li>
                      <li>Navigate to <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">platform.openai.com/api-keys</a>.</li>
                      <li>Click "Create new secret key", give it a name (e.g., "Torn Command Center"), and copy the key (starts with <code>sk-</code>).</li>
                      <li>Paste it above and click "Link key".</li>
                    </ol>
                    <p style={{ marginTop: 8, fontSize: 12 }}>Note: OpenAI charges per usage — check <a href="https://openai.com/pricing" target="_blank" rel="noopener noreferrer">pricing</a> for details. Free tier has limited credits.</p>
                  </>
                ) : (
                  <>
                    <strong>Getting a Gemini API key:</strong>
                    <ol style={{ paddingLeft: 20, marginTop: 8 }}>
                      <li>Go to <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer">aistudio.google.com</a> and sign in with your Google account.</li>
                      <li>Click "Get API key" in the left sidebar (or go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com/app/apikey</a>).</li>
                      <li>Click "Create API key", select or create a Google Cloud project, and copy the key (starts with <code>AI</code>).</li>
                      <li>Paste it above and click "Link key".</li>
                    </ol>
                    <p style={{ marginTop: 8, fontSize: 12 }}>Note: Gemini has a free tier with generous limits — check <a href="https://ai.google.dev/pricing" target="_blank" rel="noopener noreferrer">pricing</a> for details.</p>
                  </>
                )}
              </div>
            )}
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Your key is encrypted with AES-GCM server-side and used only to call the AI provider on your behalf. It is never logged, shared, or exposed to the browser.
            </p>
          </div>
        )}
      </article>
    </section>
  );
}
