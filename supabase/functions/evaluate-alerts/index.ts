import {
  adminClient,
  authenticate,
  scheduled,
  preflight,
  json,
} from "../_shared/http.ts";
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const admin = adminClient(),
      job = await scheduled(req, admin),
      user = job ? null : await authenticate(req, admin);
    if (!job && !user) return json({ error: "Unauthorized" }, 401);
    let query = admin
      .from("alert_rules")
      .select("*")
      .eq("enabled", true)
      .limit(500);
    if (user) query = query.eq("user_id", user.id);
    const { data: rules, error } = await query;
    if (error) throw error;
    let notified = 0,
      evaluated = 0;
    for (const rule of rules ?? []) {
      const { data: profile } = await admin
        .from("profiles")
        .select("tracking_paused,timezone")
        .eq("id", rule.user_id)
        .single();
      if (profile?.tracking_paused) continue;
      const hour = Number(
        new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          hour12: false,
          timeZone: profile?.timezone ?? "UTC",
        }).format(new Date()),
      );
      const a = rule.quiet_hours_start,
        b = rule.quiet_hours_end;
      if (
        a != null &&
        b != null &&
        a !== b &&
        (a < b ? hour >= a && hour < b : hour >= a || hour < b)
      )
        continue;
      evaluated++;
      let message = "";
      let signature = "";
      const { data: cache } = await admin
        .from("live_feed_cache")
        .select("payload,fetched_at")
        .eq("user_id", rule.user_id)
        .eq("feed_type", "overview")
        .maybeSingle();
      if (
        rule.condition_type === "energy_threshold" &&
        cache &&
        Date.now() - Date.parse(cache.fetched_at) < 120000
      ) {
        const bars = cache.payload.bars ?? cache.payload;
        const energy = bars.energy;
        if (
          energy &&
          energy.current >= Number(rule.threshold ?? energy.maximum)
        ) {
          message = `${rule.name}: energy ${energy.current}/${energy.maximum}`;
          signature = cache.fetched_at;
        }
      }
      if (
        rule.condition_type === "cooldown_expired" &&
        cache &&
        Date.now() - Date.parse(cache.fetched_at) < 120000
      ) {
        const values = Object.values(cache.payload.cooldowns ?? {});
        if (values.some((n) => n === 0)) {
          message = `${rule.name}: a tracked cooldown is zero`;
          signature = cache.fetched_at;
        }
      }
      if (rule.condition_type === "target_available") {
        const { data: observation } = await admin
          .from("player_observations")
          .select("torn_player_id,status,observed_at")
          .eq("user_id", rule.user_id)
          .eq("status", "Okay")
          .gte("observed_at", new Date(Date.now() - 120000).toISOString())
          .order("observed_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (observation) {
          message = `${rule.name}: player ${observation.torn_player_id} was attackable at last observation; recheck in Torn`;
          signature = observation.observed_at;
        }
      }
      if (rule.condition_type === "loan_due") {
        const day = new Date().toISOString().slice(0, 10);
        const until = new Date(
          Date.now() + Number(rule.due_soon_days ?? 3) * 86400000,
        )
          .toISOString()
          .slice(0, 10);
        const { data: loans } = await admin
          .from("faction_loans")
          .select("*")
          .eq("user_id", rule.user_id)
          .eq("status", "active")
          .lte("due_date", until);
        if (loans?.length) {
          message = `${rule.name}: ${loans.length} loan(s) overdue or due by ${until}.`;
          signature = day;
        }
      }
      if (!message) continue;
      // Bucket repeated observations to at most one notification per rule per hour.
      const dedupe_key = `rule:${rule.id}:${signature.slice(0, 13)}`;
      const { data: inserted, error } = await admin
        .from("notification_events")
        .upsert(
          { user_id: rule.user_id, rule_id: rule.id, message, dedupe_key },
          { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
        )
        .select("id");
      if (error) throw error;
      if (inserted?.length) {
        const result = await admin
          .from("notifications")
          .insert({ user_id: rule.user_id, title: rule.name, body: message });
        if (result.error) throw result.error;
        notified++;
      }
    }
    return json({
      evaluated,
      notified,
      source:
        "collected observations and manually entered loans; no continuous history is assumed",
    });
  } catch {
    return json({ error: "Alert evaluation unavailable" }, 503);
  }
});
