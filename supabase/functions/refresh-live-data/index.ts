import { createClient } from 'jsr:@supabase/supabase-js@2';
import { decrypt } from '../_shared/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FEED_ENDPOINTS: Record<string, string> = {
  travel: 'travel',
  market: 'torn',
  stocks: 'torn',
  company: 'user',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { feed_type } = await req.json();
    if (!feed_type || !FEED_ENDPOINTS[feed_type]) {
      return new Response(JSON.stringify({ error: 'Invalid feed_type' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: keyRow, error: keyError } = await serviceClient
      .from('torn_keys')
      .select('encrypted_key')
      .eq('user_id', user.id)
      .maybeSingle();

    if (keyError || !keyRow) {
      return new Response(JSON.stringify({ error: 'No Torn API key linked' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const encryptionKey = Deno.env.get('TORN_KEY_ENCRYPTION_KEY') ?? '';
    const apiKey = await decrypt(keyRow.encrypted_key, encryptionKey);

    const selection = feed_type === 'travel' ? 'travel' : feed_type === 'market' ? 'stocks' : feed_type === 'stocks' ? 'stocks' : 'profile';
    const url = `https://api.torn.com/${FEED_ENDPOINTS[feed_type]}/?selections=${selection}&key=${apiKey}`;
    const resp = await fetch(url);
    const data = await resp.json();

    if (data.error) {
      return new Response(JSON.stringify({ error: data.error.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const payload = feed_type === 'travel' ? data.travel : feed_type === 'market' ? data.stocks : feed_type === 'stocks' ? data.stocks : data;

    const { error: upsertError } = await serviceClient
      .from('live_feed_cache')
      .upsert({ user_id: user.id, feed_type, payload, fetched_at: new Date().toISOString() }, { onConflict: 'user_id,feed_type' });

    if (upsertError) {
      return new Response(JSON.stringify({ error: upsertError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: true, feed_type }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
