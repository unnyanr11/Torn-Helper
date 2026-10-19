// Torn Command Center - Edge Function: link-ai-key
// Encrypts and stores a user-supplied OpenAI or Gemini API key

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { provider, api_key } = await req.json();
    if (!provider || !['openai', 'gemini'].includes(provider)) {
      return new Response(JSON.stringify({ error: 'Invalid provider' }), { status: 400, headers: corsHeaders });
    }
    if (!api_key || typeof api_key !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing api_key' }), { status: 400, headers: corsHeaders });
    }

    // Validate key format
    if (provider === 'openai' && !api_key.startsWith('sk-')) {
      return new Response(JSON.stringify({ error: 'Invalid OpenAI key format' }), { status: 400, headers: corsHeaders });
    }
    if (provider === 'gemini' && !api_key.startsWith('AI')) {
      return new Response(JSON.stringify({ error: 'Invalid Gemini key format' }), { status: 400, headers: corsHeaders });
    }

    // Encrypt the key
    const encryptionKey = Deno.env.get('TORN_KEY_ENCRYPTION_KEY')!;
    const encrypted = await encryptKey(api_key, encryptionKey);

    // Upsert (replace existing key for this provider)
    const { error } = await supabase
      .from('encrypted_credentials')
      .upsert(
        { user_id: user.id, provider, encrypted_key: encrypted },
        { onConflict: 'user_id,provider' }
      );
    if (error) throw error;

    return new Response(JSON.stringify({ success: true, provider }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function encryptKey(plaintext: string, keyB64: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0)), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  const ivB64 = btoa(String.fromCharCode(...iv));
  const dataB64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  return `${ivB64}:${dataB64}`;
}
