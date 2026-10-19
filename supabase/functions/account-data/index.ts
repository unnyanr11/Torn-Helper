import { adminClient, authenticate, preflight, json } from "../_shared/http.ts";
const ownedTables = {
  torn_data_cache: "user_id",
  personal_stat_snapshots: "user_id",
  workspace_presets: "user_id",
  mortgage_agreements: "user_id",
  mortgage_installments: "user_id",
  mortgage_payments: "user_id",
  mortgage_events: "user_id",
  linked_torn_accounts: "user_id",
  integration_connections: "user_id",
  spy_import_jobs: "user_id",
  report_snapshots: "user_id",
  halloween_candy_log: "user_id",
  faction_members: "user_id",
  faction_chain_state: "user_id",
  faction_armory: "user_id",
  faction_territory: "user_id",
  faction_membership_events: "user_id",
  alliance_sharing_grants: "user_id",
  faction_money_requests: "user_id",
  faction_ledger_entries: "user_id",
  faction_upgrade_simulations: "user_id",
  faction_armory_events: "user_id",
  faction_loans: "user_id",
  ai_consents: "user_id",
  ai_analysis_requests: "user_id",
  travel_profit_scenarios: "user_id",
  oc_plans: "user_id",
  chain_target_queue: "user_id",
  revive_logs: "user_id",
  daily_digests: "user_id",
  revive_contracts: "user_id",
  consents: "user_id",
  feature_permissions: "user_id",
  memberships: "user_id",
  goals: "user_id",
  target_lists: "user_id",
  player_observations: "user_id",
  estimates: "user_id",
  notification_events: "user_id",
  alert_rules: "user_id",
  target_claims: "user_id",
  payout_policies: "user_id",
  payout_runs: "user_id",
  wars: "user_id",
  company_snapshots: "user_id",
  property_records: "user_id",
  travel_observations: "user_id",
  market_snapshots: "user_id",
  watchlists: "user_id",
  stock_holdings: "user_id",
  racing_records: "user_id",
  live_feed_cache: "user_id",
  notifications: "user_id",
  estimate_settings: "user_id",
  alliance_members: "user_id",
  watched_factions: "user_id",
  recruitment_requirements: "user_id",
  recruitment_candidates: "user_id",
  gym_sessions: "user_id",
  activity_observations: "user_id",
  graffiti_reactions: "user_id",
  bounties: "user_id",
  custom_columns: "user_id",
  custom_entries: "user_id",
  spy_reports: "user_id",
  dibs: "user_id",
  war_hits: "user_id",
  crime_logs: "user_id",
  flight_logs: "user_id",
  discord_webhooks: "user_id",
  target_pools: "user_id",
  notification_preferences: "user_id",
  assistant_logs: "user_id",
  loss_contracts: "buyer_user_id",
  loss_funding_records: "buyer_user_id",
  profiles: "id",
};
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const admin = adminClient();
    const user = await authenticate(req, admin);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { action } = await req.json();
    if (action === "export") {
      const output: Record<string, unknown> = {
        exported_at: new Date().toISOString(),
        user_id: user.id,
      };
      for (const [table, owner] of Object.entries(ownedTables)) {
        const all = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await admin
            .from(table)
            .select("*")
            .eq(owner, user.id)
            .range(offset, offset + 499);
          if (error) throw error;
          all.push(
            ...data.map((row: Record<string, unknown>) =>
              Object.fromEntries(
                Object.entries(row).filter(
                  ([key]) =>
                    !/key|token|secret|credential|webhook_url/i.test(key),
                ),
              ),
            ),
          );
          if (data.length < 500) break;
        }
        output[table] = all;
      }
      const allocations = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await admin
          .from("mortgage_payment_allocations")
          .select("*,mortgage_payments!inner(user_id)")
          .eq("mortgage_payments.user_id", user.id)
          .order("payment_id")
          .order("installment_id")
          .range(offset, offset + 499);
        if (error) throw error;
        allocations.push(
          ...data.map(({ mortgage_payments: _owner, ...row }) => row),
        );
        if (data.length < 500) break;
      }
      output.mortgage_payment_allocations = allocations;
      const { data: claims, error } = await admin
        .from("loss_claims")
        .select("*")
        .eq("seller_user_id", user.id);
      if (error) throw error;
      output.loss_claims = claims;
      for (const table of ["loss_settlement_entries", "revive_claims"]) {
        const { data, error } = await admin
          .from(table)
          .select("*")
          .eq("seller_user_id", user.id);
        if (error) throw error;
        output[table] = data;
      }
      const { data: credentials } = await admin
        .from("encrypted_credentials")
        .select("provider,created_at")
        .eq("user_id", user.id);
      output.credentials = credentials;
      return json(output);
    }
    if (action !== "delete") return json({ error: "Invalid action" }, 400);
    const { error: pauseError } = await admin
      .from("profiles")
      .update({ tracking_paused: true })
      .eq("id", user.id);
    if (pauseError) throw pauseError;
    const { count: open } = await admin
      .from("loss_contracts")
      .select("id", { count: "exact", head: true })
      .eq("buyer_user_id", user.id)
      .in("status", ["open", "paused"]);
    const { data: claims } = await admin
      .from("loss_claims")
      .select("id,loss_contracts!inner(buyer_user_id)")
      .or(`seller_user_id.eq.${user.id}`);
    const { count: active } = await admin
      .from("loss_claims")
      .select("id", { count: "exact", head: true })
      .eq("seller_user_id", user.id)
      .gt("reconcile_until", new Date().toISOString());
    const { count: unpaid } = await admin
      .from("loss_settlement_entries")
      .select("id", { count: "exact", head: true })
      .eq("seller_user_id", user.id)
      .neq("status", "reconciled");
    if (open || active || unpaid)
      return json(
        {
          error:
            "Cancel open contracts and settle all claims and liabilities before deletion. Tracking has been paused.",
        },
        409,
      );
    // A database pre-delete guard also checks buyer liabilities and reservations atomically.
    const result = await admin.auth.admin.deleteUser(user.id);
    if (result.error) throw result.error;
    return json({ deleted: true });
  } catch {
    return json(
      {
        error:
          "Unable to complete account request; personal data was not exported",
      },
      500,
    );
  }
});
