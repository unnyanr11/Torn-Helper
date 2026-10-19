import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

async function encryptKey(plaintext: string, secretB64: string): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const raw = Uint8Array.from(atob(secretB64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  return { ciphertext: new Uint8Array(buf), iv };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Unauthorized' }, 401);
  const userId = userData.user.id;

  let apiKey: string;
  try {
    const body = await req.json();
    apiKey = body.apiKey;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 16) {
    return json({ error: 'A valid Torn API key is required' }, 400);
  }

  const tornRes = await fetch(`https://api.torn.com/v2/user?key=${encodeURIComponent(apiKey)}`);
  if (!tornRes.ok) {
    return json({ error: 'Torn API rejected the key', status: tornRes.status }, 400);
  }
  const tornData = await tornRes.json();
  const player = tornData?.basic ?? tornData;
  if (!player?.id) {
    return json({ error: 'Could not derive Torn identity from the key' }, 400);
  }
  const tornId = BigInt(player.id);
  const tornName = player.name ?? null;
  const accessLevel = player.access_level ?? 'Minimal Access';

  const secret = Deno.env.get('TORN_KEY_ENCRYPTION_KEY');
  if (!secret) return json({ error: 'Server encryption secret not configured' }, 500);

  const { ciphertext, iv } = await encryptKey(apiKey, secret);

  const { data: linked, error: linkedError } = await supabase
    .from('linked_torn_accounts')
    .upsert(
      { user_id: userId, torn_id: tornId.toString(), torn_name: tornName, key_access_level: accessLevel, revoked_at: null },
      { onConflict: 'torn_id' }
    )
    .select('id')
    .single();
  if (linkedError || !linked) return json({ error: 'Failed to link Torn account', detail: linkedError?.message }, 500);

  const { error: credError } = await supabase
    .from('encrypted_credentials')
    .insert({ linked_account_id: linked.id, ciphertext: iv.length + ':' + btoa(String.fromCharCode(...ciphertext)) });
  if (credError) return json({ error: 'Failed to store encrypted credential', detail: credError.message }, 500);

  await supabase.from('audit_events').insert({
    actor_user_id: userId,
    action: 'link_torn_key',
    entity_type: 'linked_torn_account',
    entity_id: linked.id,
    metadata: { torn_id: tornId.toString(), access_level: accessLevel },
  });

  return json({
    linked: true,
    torn_id: tornId.toString(),
    torn_name: tornName,
    key_access_level: accessLevel,
    disclosure: {
      storage: 'Encrypted (AES-GCM) in a private database schema, server-only access',
      retention: 'Retained until you remove the key or delete your account',
      sharing: 'Not shared with third parties without separate explicit consent',
      purpose: 'Read-only Torn data for the features you enable',
    },
  });
});
