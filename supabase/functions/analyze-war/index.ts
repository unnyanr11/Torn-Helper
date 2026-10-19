import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { war_id } = await req.json();
    if (!war_id) throw new Error('war_id required');

    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: war, error: warErr } = await supabase.from('wars').select('*').eq('id', war_id).single();
    if (warErr || !war) throw new Error('War not found');

    const { data: targets } = await supabase.from('targets').select('*').eq('war_id', war_id);
    const { data: observations } = await supabase.from('target_observations').select('*').in('target_id', (targets ?? []).map((t: any) => t.id));

    const targetList = targets ?? [];
    const obsList = observations ?? [];

    const totalTargets = targetList.length;
    const observedTargets = new Set(obsList.map((o: any) => o.target_id)).size;
    const onlineObs = obsList.filter((o: any) => o.status === 'online').length;
    const totalObs = obsList.length;
    const onlineRate = totalObs > 0 ? onlineObs / totalObs : 0;
    const coverage = totalTargets > 0 ? observedTargets / totalTargets : 0;

    const perTarget: Record<string, { online: number; total: number }> = {};
    for (const o of obsList) {
      perTarget[o.target_id] = perTarget[o.target_id] ?? { online: 0, total: 0 };
      perTarget[o.target_id].total += 1;
      if (o.status === 'online') perTarget[o.target_id].online += 1;
    }
    const ranked = Object.entries(perTarget)
      .map(([id, v]) => ({ target_id: id, online_rate: v.total > 0 ? v.online / v.total : 0, observations: v.total }))
      .sort((a, b) => b.online_rate - a.online_rate);

    const mostActive = ranked.slice(0, 5);
    const leastActive = ranked.slice(-5).reverse();

    const insights: string[] = [];
    if (totalTargets === 0) {
      insights.push('No targets are linked to this war yet. Add targets to generate analysis.');
    } else {
      insights.push(`War covers ${totalTargets} target(s); ${observedTargets} have at least one observation (${Math.round(coverage * 100)}% coverage).`);
      if (totalObs > 0) {
        insights.push(`Across ${totalObs} observations, targets were online ${Math.round(onlineRate * 100)}% of the time.`);
      } else {
        insights.push('No observations recorded yet - activity patterns cannot be assessed.');
      }
      if (mostActive.length > 0) {
        insights.push(`Most active targets: ${mostActive.map((t) => t.target_id).join(', ')}.`);
      }
      if (leastActive.length > 0 && leastActive[0].online_rate < 0.2) {
        insights.push(`Low-activity targets worth prioritizing for hits: ${leastActive.map((t) => t.target_id).join(', ')}.`);
      }
      if (coverage < 0.5) {
        insights.push('Coverage is below 50% - increase observation frequency before drawing conclusions.');
      }
    }

    const analysis = {
      generated_at: new Date().toISOString(),
      total_targets: totalTargets,
      observed_targets: observedTargets,
      coverage,
      total_observations: totalObs,
      online_rate: onlineRate,
      most_active: mostActive,
      least_active: leastActive,
      insights,
    };

    const { error: updErr } = await supabase.from('wars').update({ analysis }).eq('id', war_id);
    if (updErr) throw updErr;

    return new Response(JSON.stringify({ ok: true, analysis }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
