// Torn Command Center - Edge Function: verify-loss-funding
// Checks operator account's item log for incoming Xanax transfers matching pending funding records.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get operator's Torn API key (stored encrypted, tied to operator user)
    const { data: operatorCred, error: credError } = await supabase
      .from('encrypted_credentials')
      .select('user_id, encrypted_key')
      .eq('role', 'operator')
      .single();
    if (credError || !operatorCred) throw new Error('No operator credential found');

    const encryptionKey = Deno.env.get('TORN_KEY_ENCRYPTION_KEY')!;
    const tornApiKey = await decryptKey(operatorCred.encrypted_key, encryptionKey);

    // Fetch operator's item log (Xanax = item 206)
    const tornRes = await fetch(`https://api.torn.com/user/?selections=log&key=${tornApiKey}`);
    const tornData = await tornRes.json();
    if (tornData.error) throw new Error(tornData.error.error);

    const logEntries = tornData.log ?? [];
    const xanaxTransfers = logEntries.filter(
      (e: any) => e.type === 'itemSend' && e.data?.item === 206
    );

    // Get pending funding records
    const { data: pending, error: pendingError } = await supabase
      .from('loss_funding_records')
      .select('*, loss_contracts(*)')
      .eq('status', 'pending')
      .eq('currency', 'xanax');
    if (pendingError) throw pendingError;

    const results = [];
    for (const record of pending) {
      const expectedAmount = record.amount;
      const messageCode = `loss:${record.contract_id.slice(0, 8)}`;

      // Match by amount + message code in transfer title
      const match = xanaxTransfers.find(
        (t: any) =>
          t.data?.amount === expectedAmount &&
          (t.title?.includes(messageCode) || t.data?.message?.includes(messageCode))
      );

      if (match) {
        await supabase
          .from('loss_funding_records')
          .update({ status: 'verified', verified_at: new Date().toISOString(), verified_by: 'auto', transaction_ref: match.id, sender_torn_id: match.data?.sender })
          .eq('id', record.id);

        // Mark contract as funded
        await supabase
          .from('loss_contracts')
          .update({ status: 'open' })
          .eq('id', record.contract_id);

        results.push({ record_id: record.id, verified: true, transaction_ref: match.id });
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
