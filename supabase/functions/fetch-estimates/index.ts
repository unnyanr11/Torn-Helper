import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { target_id } = await req.json();
    if (!target_id) {
      return new Response(JSON.stringify({ error: 'target_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: settings } = await serviceClient
      .from('estimate_settings')
      .select('source, enabled')
      .eq('user_id', user.id)
      .eq('enabled', true);

    const enabledSources = (settings ?? []).map((s) => s.source);
    if (enabledSources.length === 0) {
      return new Response(JSON.stringify({ error: 'No estimate sources enabled' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results: Record<string, unknown> = {};

    for (const source of enabledSources) {
      try {
        let estimate: number | null = null;
        if (source === 'ffscouter') {
          const resp = await fetch(`https://ffscouter.com/api/v1/get-stats?key=${Deno.env.get('FFSCOUTER_API_KEY') ?? ''}&targets=${target_id}`);
          const data = await resp.json();
          estimate = data?.targets?.[String(target_id)]?.fair_fight ?? null;
        } else if (source === 'tornstats') {
          const resp = await fetch(`https://www.tornstats.com/api/v2/${Deno.env.get('TORNSTATS_API_KEY') ?? ''}/spy/user/${target_id}`);
          const data = await resp.json();
          estimate = data?.spy?.strength ?? null;
        }

        if (estimate != null) {
          await serviceClient
            .from('target_estimates')
            .upsert({
              user_id: user.id,
              target_id,
              source,
              estimate,
              fetched_at: new Date().toISOString(),
            }, { onConflict: 'user_id,target_id,source' });
          results[source] = estimate;
        } else {
          results[source] = 'no data';
        }
      } catch (e) {
        results[source] = `error: ${String(e)}`;
      }
    }

    return new Response(JSON.stringify({ ok: true, target_id, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
