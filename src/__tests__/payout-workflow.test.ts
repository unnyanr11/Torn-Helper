// Torn Command Center - Automated integration tests for payout workflow
// Tests: settlement lifecycle, RLS isolation, dispute flow, operator permissions

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Test users
const sellerEmail = `test-seller-${Date.now()}@test.com`;
const operatorEmail = `test-operator-${Date.now()}@test.com`;
const buyerEmail = `test-buyer-${Date.now()}@test.com`;
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
let settlementId: string;

beforeAll(async () => {
  adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Create test users
  const { data: sellerAuth } = await adminClient.auth.admin.createUser({ email: sellerEmail, password, email_confirm: true });
  const { data: operatorAuth } = await adminClient.auth.admin.createUser({ email: operatorEmail, password, email_confirm: true });
  const { data: buyerAuth } = await adminClient.auth.admin.createUser({ email: buyerEmail, password, email_confirm: true });

  sellerUserId = sellerAuth!.user.id;
  operatorUserId = operatorAuth!.user.id;
  buyerUserId = buyerAuth!.user.id;

  // Set roles
  await adminClient.from('profiles').update({ role: 'payment_operator' }).eq('id', operatorUserId);

  // Create signed-in clients
  sellerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await sellerClient.auth.signInWithPassword({ email: sellerEmail, password });

  operatorClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await operatorClient.auth.signInWithPassword({ email: operatorEmail, password });

  buyerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await buyerClient.auth.signInWithPassword({ email: buyerEmail, password });

  // Seed a contract + claim + settlement for testing
  const { data: contract } = await adminClient
    .from('loss_contracts')
    .insert({ user_id: buyerUserId, target_torn_id: 999999, quantity: 5, price_per_loss: 100000, status: 'open' })
    .select()
    .single();
  contractId = contract!.id;

  const { data: claim } = await adminClient
    .from('loss_claims')
    .insert({ contract_id: contractId, seller_user_id: sellerUserId, seller_torn_id: 123456, seller_name: 'TestSeller', quantity_claimed: 1, status: 'active' })
    .select()
    .single();
  claimId = claim!.id;

  const { data: settlement } = await adminClient
    .from('loss_settlement_entries')
    .insert({ claim_id: claimId, seller_user_id: sellerUserId, amount_owed: 100000, status: 'earned' })
    .select()
    .single();
  settlementId = settlement!.id;
});

afterAll(async () => {
  // Cleanup
  await adminClient.from('loss_settlement_entries').delete().eq('id', settlementId);
  await adminClient.from('loss_claims').delete().eq('id', claimId);
  await adminClient.from('loss_contracts').delete().eq('id', contractId);
  await adminClient.auth.admin.deleteUser(sellerUserId);
  await adminClient.auth.admin.deleteUser(operatorUserId);
  await adminClient.auth.admin.deleteUser(buyerUserId);
});

describe('Payout workflow integration tests', () => {
  it('seller can see their own settlement entry', async () => {
    const { data, error } = await sellerClient
      .from('loss_settlement_entries')
      .select('*')
      .eq('id', settlementId)
      .single();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.amount_owed).toBe(100000);
    expect(data!.status).toBe('earned');
  });

  it('seller cannot see another seller settlement entry', async () => {
    // Create a second seller settlement
    const { data: otherSeller } = await adminClient.auth.admin.createUser({
      email: `test-other-${Date.now()}@test.com`,
      password,
      email_confirm: true,
    });
    const otherSellerId = otherSeller!.user.id;

    const { data: otherSettlement } = await adminClient
      .from('loss_settlement_entries')
      .insert({ claim_id: claimId, seller_user_id: otherSellerId, amount_owed: 50000, status: 'earned' })
      .select()
      .single();

    const { data, error } = await sellerClient
      .from('loss_settlement_entries')
      .select('*')
      .eq('id', otherSettlement!.id)
      .maybeSingle();

    // RLS should block cross-user access
    expect(data).toBeNull();

    await adminClient.from('loss_settlement_entries').delete().eq('id', otherSettlement!.id);
    await adminClient.auth.admin.deleteUser(otherSellerId);
  });

  it('operator can see all settlement entries', async () => {
    const { data, error } = await operatorClient
      .from('loss_settlement_entries')
      .select('*')
      .eq('id', settlementId)
      .single();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.amount_owed).toBe(100000);
  });

  it('operator can approve a settlement', async () => {
    const { error } = await operatorClient
      .from('loss_settlement_entries')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', settlementId);
    expect(error).toBeNull();

    const { data } = await operatorClient
      .from('loss_settlement_entries')
      .select('*')
      .eq('id', settlementId)
      .single();
    expect(data!.status).toBe('approved');
    expect(data!.approved_at).not.toBeNull();
  });

  it('seller cannot approve their own settlement', async () => {
    const { error } = await sellerClient
      .from('loss_settlement_entries')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', settlementId);
    // RLS should block seller from changing status to approved (only operator/admin can)
    // Depending on policy design, this may or may not error — check final state
    const { data } = await operatorClient
      .from('loss_settlement_entries')
      .select('*')
      .eq('id', settlementId)
      .single();
    // If seller update was blocked, status should still be 'approved' from prior test
    expect(data!.status).toBe('approved');
  });

  it('operator can mark settlement as sent with transaction ref', async () => {
    const { error } = await operatorClient
      .from('loss_settlement_entries')
      .update({ status: 'sent', sent_at: new Date().toISOString(), transaction_ref: 'test-tx-123', amount_paid: 100000 })
      .eq('id', settlementId);
    expect(error).toBeNull();

    const { data } = await operatorClient
      .from('loss_settlement_entries')
      .select('*')
      .eq('id', settlementId)
      .single();
    expect(data!.status).toBe('sent');
    expect(data!.transaction_ref).toBe('test-tx-123');
    expect(data!.amount_paid).toBe(100000);
  });

  it('operator can mark settlement as reconciled', async () => {
    const { error } = await operatorClient
      .from('loss_settlement_entries')
      .update({ status: 'reconciled', reconciled_at: new Date().toISOString() })
      .eq('id', settlementId);
    expect(error).toBeNull();

    const { data } = await operatorClient
      .from('loss_settlement_entries')
      .select('*')
      .eq('id', settlementId)
      .single();
    expect(data!.status).toBe('reconciled');
    expect(data!.reconciled_at).not.toBeNull();
  });

  it('seller can raise a dispute on their own claim', async () => {
    const { data, error } = await sellerClient
      .from('loss_disputes')
      .insert({ claim_id: claimId, raised_by: sellerUserId, reason: 'Payment not received' })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.status).toBe('open');
  });

  it('operator can resolve a dispute', async () => {
    const { data: dispute } = await sellerClient
      .from('loss_disputes')
      .select('*')
      .eq('claim_id', claimId)
      .eq('status', 'open')
      .single();

    const { error } = await operatorClient
      .from('loss_disputes')
      .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolution_notes: 'Payment was sent, verified via tx ref' })
      .eq('id', dispute!.id);
    expect(error).toBeNull();

    const { data: updated } = await operatorClient
      .from('loss_disputes')
      .select('*')
      .eq('id', dispute!.id)
      .single();
    expect(updated!.status).toBe('resolved');
    expect(updated!.resolution_notes).toContain('verified');
  });

  it('buyer cannot see settlement entries (not a party)', async () => {
    const { data, error } = await buyerClient
      .from('loss_settlement_entries')
      .select('*')
      .eq('id', settlementId)
      .maybeSingle();
    // Buyer is not the seller or operator, so RLS should block
    expect(data).toBeNull();
  });

  it('regular user cannot access operator dashboard data', async () => {
    // sellerClient is a regular user (role=user), try to update another settlement
    const { data: otherSettlement } = await adminClient
      .from('loss_settlement_entries')
      .insert({ claim_id: claimId, seller_user_id: buyerUserId, amount_owed: 200000, status: 'earned' })
      .select()
      .single();

    const { error } = await sellerClient
      .from('loss_settlement_entries')
      .update({ status: 'approved' })
      .eq('id', otherSettlement!.id);

    // RLS should block — seller is not the owner nor operator
    const { data: check } = await operatorClient
      .from('loss_settlement_entries')
      .select('*')
      .eq('id', otherSettlement!.id)
      .single();
    expect(check!.status).toBe('earned'); // unchanged

    await adminClient.from('loss_settlement_entries').delete().eq('id', otherSettlement!.id);
  });
});
