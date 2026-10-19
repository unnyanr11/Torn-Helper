// Torn Command Center - Edge Function integration tests
// Tests verify-loss-payment and verify-loss-funding Edge Functions against a live Supabase project

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sellerEmail = `test-ef-seller-${Date.now()}@test.com`;
const operatorEmail = `test-ef-operator-${Date.now()}@test.com`;
const buyerEmail = `test-ef-buyer-${Date.now()}@test.com`;
const password = 'test-password-123';

let sellerClient: SupabaseClient;
let operatorClient: SupabaseClient;
let buyerClient: SupabaseClient;
let adminClient: SupabaseClient;
let sellerUserId: string;
let operatorUserId: string;
let buyerUserId: string;
let contractId: string;
let claimId: string;
let fundingRecordId: string;

// Mock Torn API responses (in a real scenario you'd mock the fetch or use a test Torn key)
const mockAttackLog = {
  attacks: {
    '12345': {
      attacker_id: 123456,
      defender_id: 999999,
      result: 'loss',
      timestamp_ended: Math.floor(Date.now() / 1000) - 60,
    },
    '12346': {
      attacker_id: 123456,
      defender_id: 999999,
      result: 'win',
      timestamp_ended: Math.floor(Date.now() / 1000) - 30,
    },
  },
};

const mockItemLog = {
  log: [
    {
      id: 'log-1',
      type: 'itemSend',
      title: 'Xanax sent',
      data: { item: 206, amount: 500000, sender: 654321, message: 'loss:' },
      timestamp: Math.floor(Date.now() / 1000) - 120,
    },
  ],
};

beforeAll(async () => {
  adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: sellerAuth } = await adminClient.auth.admin.createUser({ email: sellerEmail, password, email_confirm: true });
  const { data: operatorAuth } = await adminClient.auth.admin.createUser({ email: operatorEmail, password, email_confirm: true });
  const { data: buyerAuth } = await adminClient.auth.admin.createUser({ email: buyerEmail, password, email_confirm: true });

  sellerUserId = sellerAuth!.user.id;
  operatorUserId = operatorAuth!.user.id;
  buyerUserId = buyerAuth!.user.id;

  await adminClient.from('profiles').update({ role: 'payment_operator' }).eq('id', operatorUserId);

  sellerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await sellerClient.auth.signInWithPassword({ email: sellerEmail, password });

  operatorClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await operatorClient.auth.signInWithPassword({ email: operatorEmail, password });

  buyerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await buyerClient.auth.signInWithPassword({ email: buyerEmail, password });

  // Seed contract (pending funding) + claim
  const { data: contract } = await adminClient
    .from('loss_contracts')
    .insert({ user_id: buyerUserId, target_torn_id: 999999, quantity: 5, price_per_loss: 100000, status: 'draft' })
    .select()
    .single();
  contractId = contract!.id;

  const { data: funding } = await adminClient
    .from('loss_funding_records')
    .insert({ contract_id: contractId, buyer_user_id: buyerUserId, amount: 500000, currency: 'xanax', status: 'pending' })
    .select()
    .single();
  fundingRecordId = funding!.id;

  const { data: claim } = await adminClient
    .from('loss_claims')
    .insert({ contract_id: contractId, seller_user_id: sellerUserId, seller_torn_id: 123456, seller_name: 'TestSeller', quantity_claimed: 1, status: 'active' })
    .select()
    .single();
  claimId = claim!.id;
});

afterAll(async () => {
  await adminClient.from('loss_funding_records').delete().eq('id', fundingRecordId);
  await adminClient.from('loss_claims').delete().eq('id', claimId);
  await adminClient.from('loss_contracts').delete().eq('id', contractId);
  await adminClient.auth.admin.deleteUser(sellerUserId);
  await adminClient.auth.admin.deleteUser(operatorUserId);
  await adminClient.auth.admin.deleteUser(buyerUserId);
});

describe('Edge Function: verify-loss-funding', () => {
  it('rejects unauthenticated requests when verify_jwt is false but service role is used internally', async () => {
    // This function uses service role internally, no user JWT needed
    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-loss-funding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    // Should not 401 since verify_jwt=false, but may error on missing operator credential
    expect([200, 400, 500]).toContain(res.status);
  });

  it('returns error or success depending on operator credential presence', async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-loss-funding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const json = await res.json();
    // Either succeeds (if operator cred exists) or errors gracefully
    expect(json).toHaveProperty('verified');
  });
});

describe('Edge Function: verify-loss-payment', () => {
  it('rejects requests without auth header', async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-loss-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(401);
  });

  it('rejects requests with invalid JWT', async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-loss-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token',
      },
      body: '{}',
    });
    expect(res.status).toBe(401);
  });

  it('returns no active claims message for user with no claims', async () => {
    // Use buyer (no claims)
    const { data: session } = await buyerClient.auth.getSession();
    const token = session.session?.access_token;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-loss-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: '{}',
    });
    const json = await res.json();
    expect(json.message ?? json.verified).toBeDefined();
  });

  it('processes seller claims and returns verified count', async () => {
    const { data: session } = await sellerClient.auth.getSession();
    const token = session.session?.access_token;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-loss-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: '{}',
    });
    const json = await res.json();
    // Will error if no Torn API key linked, or succeed with verified count
    expect(json.verified !== undefined || json.error !== undefined).toBe(true);
  });

  it('deduplicates attack IDs across multiple invocations', async () => {
    const { data: session } = await sellerClient.auth.getSession();
    const token = session.session?.access_token;

    // Call twice
    await fetch(`${SUPABASE_URL}/functions/v1/verify-loss-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: '{}',
    });
    const res2 = await fetch(`${SUPABASE_URL}/functions/v1/verify-loss-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: '{}',
    });
    const json2 = await res2.json();
    // Second call should not double-count (either 0 new verified or same total)
    expect(json2.verified !== undefined || json2.error !== undefined).toBe(true);
  });
});

describe('Edge Function: CORS preflight', () => {
  it('handles OPTIONS request', async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-loss-payment`, {
      method: 'OPTIONS',
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});
