import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

async function decryptKey(payload: string, secretB64: string): Promise<string> {
  const [ivLenStr, b64] = payload.split(':');
  const ivLen = parseInt(ivLenStr);
  const raw = Uint8Array.from(atob(secretB64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const iv = data.slice(0, ivLen);
  const ct = data.slice(ivLen);
  const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(buf);
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

  let listId: string;
  try {
    const body = await req.json();
    listId = body.listId;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (!listId) return json({ error: 'listId is required' }, 400);

  const { data: linked, error: linkedError } = await supabase
    .from('linked_torn_accounts')
    .select('id, torn_id')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .maybeSingle();
  if (linkedError || !linked) return json({ error: 'No active linked Torn account. Link a key first.' }, 400);

  const { data: cred, error: credError } = await supabase
    .from('encrypted_credentials')
    .select('ciphertext')
    .eq('linked_account_id', linked.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (credError || !cred) return json({ error: 'No stored credential found' }, 400);

  const secret = Deno.env.get('TORN_KEY_ENCRYPTION_KEY');
  if (!secret) return json({ error: 'Server encryption secret not configured' }, 500);

  let apiKey: string;
  try {
    apiKey = await decryptKey(cred.ciphertext as unknown as string, secret);
  } catch {
    return json({ error: 'Failed to decrypt stored credential' }, 500);
  }

  const { data: entries, error: entriesError } = await supabase
    .from('target_list_entries')
    .select('id, torn_player_id')
    .eq('list_id', listId)
    .eq('excluded', false);
  if (entriesError) return json({ error: 'Failed to load targets', detail: entriesError.message }, 500);
  if (!entries?.length) return json({ refreshed: 0, results: [] });

  const results: Array<{ torn_player_id: string; status?: string; level?: number; error?: string }> = [];

  for (const entry of entries) {
    try {
      const res = await fetch(`https://api.torn.com/user/${entry.torn_player_id}?selections=basic&key=${encodeURIComponent(apiKey)}`);
      if (!res.ok) {
        results.push({ torn_player_id: entry.torn_player_id, error: `HTTP ${res.status}` });
        continue;
      }
      const data = await res.json();
      if (data.error) {
        results.push({ torn_player_id: entry.torn_player_id, error: data.error.error });
        continue;
      }
      const status = data.status?.state ?? null;
      const level = data.level ?? null;
      const lastAction = data.last_action?.relative ?? null;

      await supabase.from('target_list_entries').update({
        status,
        level,
        last_checked_at: new Date().toISOString(),
      }).eq('id', entry.id);

      await supabase.from('player_observations').insert({
        user_id: userId,
        torn_player_id: entry.torn_player_id,
        status,
        level,
        last_action: lastAction,
      });

      results.push({ torn_player_id: entry.torn_player_id, status: status ?? undefined, level: level ?? undefined });
    } catch (e) {
      results.push({ torn_player_id: entry.torn_player_id, error: String(e) });
    }
  }

  return json({ refreshed: results.length, results });
});
