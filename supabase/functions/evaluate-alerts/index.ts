import { createClient } from 'jsr:@supabase/supabase-js@2';
import { decrypt } from '../_shared/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (_req) => {
  try {
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all users with active alerts
    const { data: alerts, error: alertsError } = await serviceClient
      .from('target_alerts')
      .select('id, user_id, target_id, condition, active')
      .eq('active', true);

    if (alertsError) {
      return new Response(JSON.stringify({ error: alertsError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!alerts || alerts.length === 0) {
      return new Response(JSON.stringify({ ok: true, evaluated: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Group alerts by user
    const byUser: Record<string, typeof alerts> = {};
    alerts.forEach((a) => {
      (byUser[a.user_id] ??= []).push(a);
    });

    const encryptionKey = Deno.env.get('TORN_KEY_ENCRYPTION_KEY') ?? '';
    let evaluated = 0;
    let notified = 0;

    for (const [userId, userAlerts] of Object.entries(byUser)) {
      const { data: keyRow } = await serviceClient
        .from('torn_keys')
        .select('encrypted_key')
        .eq('user_id', userId)
        .maybeSingle();

      if (!keyRow) continue;

      const apiKey = await decrypt(keyRow.encrypted_key, encryptionKey);

      for (const alert of userAlerts) {
        evaluated++;
        const url = `https://api.torn.com/user/${alert.target_id}?selections=basic&key=${apiKey}`;
        const resp = await fetch(url);
        const data = await resp.json();

        if (data.error) continue;

        const status = data.status?.state ?? '';
        const condition = alert.condition ?? '';

        // Simple condition matching: "OK", "Hospital", "Jail", "Traveling", "Abroad"
        let met = false;
        if (condition === 'OK') met = status === 'OK';
        else if (condition === 'Hospital') met = status === 'Hospital';
        else if (condition === 'Jail') met = status === 'Jail';
        else if (condition === 'Traveling' || condition === 'Abroad') met = status === 'Traveling' || status === 'Abroad';

        if (met) {
          const { error: notifError } = await serviceClient
            .from('notifications')
            .insert({
              user_id: userId,
              title: `Target alert: ${data.name ?? alert.target_id}`,
              body: `Target ${data.name ?? alert.target_id} is now ${status}.`,
            });
          if (!notifError) {
            notified++;
            await serviceClient.from('target_alerts').update({ active: false }).eq('id', alert.id);
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, evaluated, notified }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
