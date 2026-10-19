// Torn Command Center - Edge Function: verify-loss-payment
// Polls seller's attack log via their Limited Access API key, matches against active claims, dedupes by attack ID, and updates settlement ledger.

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

    // Get user's active claims + linked contracts
    const { data: claims, error: claimsError } = await supabase
      .from('loss_claims')
      .select('*, loss_contracts(*)')
      .eq('seller_user_id', user.id)
      .eq('status', 'active');
    if (claimsError) throw claimsError;
    if (!claims || claims.length === 0) {
      return new Response(JSON.stringify({ message: 'No active claims' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Decrypt seller's Torn API key (stored encrypted)
    const { data: cred, error: credError } = await supabase
      .from('encrypted_credentials')
      .select('encrypted_key')
      .eq('user_id', user.id)
      .single();
    if (credError || !cred) throw new Error('No Torn API key linked');

    const encryptionKey = Deno.env.get('TORN_KEY_ENCRYPTION_KEY')!;
    const tornApiKey = await decryptKey(cred.encrypted_key, encryptionKey);

    // Fetch attack log from Torn API
    const tornRes = await fetch(`https://api.torn.com/user/?selections=attacks&key=${tornApiKey}`);
    const tornData = await tornRes.json();
    if (tornData.error) throw new Error(tornData.error.error);

    const attacks = tornData.attacks ?? {};
    const results = [];

    for (const claim of claims) {
      const contract = claim.loss_contracts;
      const targetId = contract.target_torn_id;
      const claimStart = new Date(claim.claimed_at);
      const claimExpiry = new Date(claim.expires_at);

      for (const [attackId, attack] of Object.entries(attacks)) {
        const attackTime = new Date(attack.timestamp_ended * 1000);
        if (attackTime < claimStart || attackTime > claimExpiry) continue;
        if (attack.attacker_id !== user.torn_id) continue;
        if (attack.defender_id !== targetId) continue;

        // Check dedup
        const { data: existing } = await supabase
          .from('loss_attack_evidence')
          .select('id')
          .eq('attack_id', attackId)
          .maybeSingle();
        if (existing) continue;

        const outcome = attack.result === 'loss' ? 'loss' : attack.result === 'win' ? 'win' : 'other';
        const isVerified = outcome === 'loss';

        const { data: evidence, error: evidenceError } = await supabase
          .from('loss_attack_evidence')
          .insert({
            claim_id: claim.id,
            attack_id: parseInt(attackId),
            seller_torn_id: user.torn_id,
            target_torn_id: targetId,
            attack_timestamp: attackTime.toISOString(),
            outcome,
            verified: isVerified,
            verified_at: isVerified ? new Date().toISOString() : null,
            raw_payload: attack,
          })
          .select()
          .single();
        if (evidenceError) throw evidenceError;

        if (isVerified) {
          // Update or create settlement entry
          const amountOwed = contract.price_per_loss;
          const { data: existingSettlement } = await supabase
            .from('loss_settlement_entries')
            .select('*')
            .eq('claim_id', claim.id)
            .eq('seller_user_id', user.id)
            .maybeSingle();

          if (existingSettlement) {
            await supabase
              .from('loss_settlement_entries')
              .update({ amount_owed: existingSettlement.amount_owed + amountOwed })
              .eq('id', existingSettlement.id);
          } else {
            await supabase
              .from('loss_settlement_entries')
              .insert({ claim_id: claim.id, seller_user_id: user.id, amount_owed: amountOwed });
          }
        }

        results.push({ attack_id: attackId, outcome, verified: isVerified });
      }
    }

    return new Response(JSON.stringify({ verified: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function decryptKey(encrypted: string, keyB64: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0)), 'AES-GCM', false, ['decrypt']);
  const [ivB64, dataB64] = encrypted.split(':');
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const data = Uint8Array.from(atob(dataB64), (c) => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(decrypted);
}
