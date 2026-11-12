import {alertHour,quietHour,isolatedAlertRules} from '../_shared/alert-isolation.ts';
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
      .order("last_evaluated_at",{ascending:true,nullsFirst:true})
      .order("id")
      .limit(500);
    if (user) query = query.eq("user_id", user.id);
    const { data: rules, error } = await query;
    if (error) throw error;
    let notified = 0,
      evaluated = 0;
    const failed=await isolatedAlertRules(rules??[],async(rule)=>{
      const { data: profile } = await admin
        .from("profiles")
        .select("tracking_paused,timezone")
        .eq("id", rule.user_id)
        .single();
      if (profile?.tracking_paused) return;
      const hour=alertHour(profile?.timezone);
      const a=quietHour(rule.quiet_hours_start),b=quietHour(rule.quiet_hours_end);
      if (
        a != null &&
        b != null &&
        a !== b &&
        (a < b ? hour >= a && hour < b : hour >= a || hour < b)
      )
        return;
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
      if (rule.condition_type === "cooldown_expired") {
        const timers=await admin.from('torn_timer_baselines').select('deadlines,observed_at').eq('user_id',rule.user_id).eq('endpoint_id','v2-user-cooldowns').maybeSingle();
        if(timers.error)throw timers.error;
        const baseline=timers.data;
        if(baseline){
          const observed=Date.parse(baseline.observed_at)/1000;
          const expired=Object.entries(baseline.deadlines??{}).filter(([,end])=>typeof end==='number'&&end>observed&&end<=Date.now()/1000).sort(([,a],[,b])=>Number(b)-Number(a));
          if(expired.length){message=`${rule.name}: ${expired[0][0]} cooldown timer elapsed (estimated from the saved deadline).`;signature=`${expired[0][0]}:${expired[0][1]}`;}
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
          Date.now() + Math.min(365,Math.max(0,Number(rule.due_soon_days)||3)) * 86400000,
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
      if (!message) return;
      // Bucket repeated observations to at most one notification per rule per hour.
      const dedupe_key = `rule:${rule.id}:${rule.condition_type==='cooldown_expired'?signature:signature.slice(0,13)}`;
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
    },async(rule)=>{const marked=await admin.from("alert_rules").update({last_evaluated_at:new Date().toISOString()}).eq("id",rule.id);if(marked.error)throw marked.error;});
    return json({
      failed,
      evaluated,
      notified,
      source:
        "collected observations and manually entered loans; no continuous history is assumed",
    });
  } catch {
    return json({ error: "Alert evaluation unavailable" }, 503);
  }
});
