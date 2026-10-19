// Torn Command Center - AI war analyzer Edge Function (spec section 7C #17)
// Deploy: supabase functions deploy analyze-war-ai
// Secret: supabase secrets set AI_PROVIDER_API_KEY=<your-openai-key>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { warId, evidence } = await req.json();
    if (!evidence || typeof evidence !== 'object') return new Response(JSON.stringify({ error: 'Missing evidence' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Check consent
    const { data: consent } = await supabase.from('ai_consents').select('consented').eq('user_id', user.id).eq('provider', 'openai').maybeSingle();
    if (!consent?.consented) return new Response(JSON.stringify({ error: 'AI processing consent not granted' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const apiKey = Deno.env.get('AI_PROVIDER_API_KEY');
    if (!apiKey) return new Response(JSON.stringify({ error: 'AI provider not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Log request
    const { data: reqRow } = await supabase.from('ai_analysis_requests').insert({ user_id: user.id, war_id: warId ?? null, provider: 'openai', model: 'gpt-4o-mini', status: 'pending' }).select().single();

    const prompt = `You are a war analyst for a Torn City faction. Summarize the following war evidence, highlight contribution patterns, flag anomalies for human review, and suggest payout-policy considerations. Never allocate money or authorize payments — recommendations only. Evidence JSON:\n\n${JSON.stringify(evidence).slice(0, 12000)}`;

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 800 }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      await supabase.from('ai_analysis_requests').update({ status: 'failed', error_message: errText.slice(0, 500) }).eq('id', reqRow.id);
      return new Response(JSON.stringify({ error: 'AI provider error' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aiJson = await aiRes.json();
    const summary = aiJson.choices?.[0]?.message?.content ?? '';
    await supabase.from('ai_analysis_requests').update({ status: 'complete', response: summary }).eq('id', reqRow.id);

    return new Response(JSON.stringify({ summary, requestId: reqRow.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
