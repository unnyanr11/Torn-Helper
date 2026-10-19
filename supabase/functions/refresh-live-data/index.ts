import { adminClient, authenticate, preflight, json } from "../_shared/http.ts";
import {
  collectOverview,
  resolveRefreshKey,
  refreshFailure,
} from "../_shared/live-refresh.ts";
import { personalStatValues } from "../_shared/history.ts";
import { tornGet } from "../_shared/torn.ts";
const endpoints: Record<string, string> = {
  travel: "/user/travel",
  stocks: "/torn/stocks",
  market: "/torn/items",
  company: "/user/job",
  overview: "/user",
};
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const admin = adminClient();
    const user = await authenticate(req, admin);
    if (!user) return json({ error: "Unauthorized" }, 401);
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid request body" }, 400);
    }
    const { feed_type, apiKey } = body ?? {};
    if (!Object.hasOwn(endpoints, feed_type))
      return json({ error: "Unsupported feed" }, 400);
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("tracking_paused")
      .eq("id", user.id)
      .single();
    if (profileError) throw profileError;
    if (profile?.tracking_paused)
      return json({ error: "Tracking paused" }, 409);
    const { data: cache, error: cacheError } = await admin
      .from("live_feed_cache")
      .select("*")
      .eq("user_id", user.id)
      .eq("feed_type", feed_type)
      .maybeSingle();
    if (cacheError) throw cacheError;
    // Verify request-only ownership even when an observation is cached.
    const key = await resolveRefreshKey(
      admin,
      user.id,
      apiKey,
      Deno.env.get("TORN_KEY_ENCRYPTION_KEY"),
    );
    if (
      cache &&
      Date.now() - Date.parse(cache.fetched_at) < cache.ttl_seconds * 1000
    )
      return json({
        ok: true,
        cached: true,
        payload: cache.payload,
        fetched_at: cache.fetched_at,
      });
    const payload =
      feed_type === "overview"
        ? await collectOverview(key)
        : await tornGet(endpoints[feed_type], key);
    const fetched_at = new Date().toISOString();
    let history_recorded = false;
    if (feed_type === "overview") {
      const result = await admin.rpc("record_personal_snapshot", {
        owner_id: user.id,
        observed_at: fetched_at,
        values_json: personalStatValues(payload),
      });
      if (result.error) throw result.error;
      history_recorded = result.data === true;
    }
    const { error } = await admin
      .from("live_feed_cache")
      .upsert(
        { user_id: user.id, feed_type, payload, fetched_at, ttl_seconds: 60 },
        { onConflict: "user_id,feed_type" },
      );
    if (error) throw error;
    return json({ ok: true, payload, fetched_at, history_recorded });
  } catch (error) {
    const failure = refreshFailure(error);
    return json({ error: failure.error }, failure.status);
  }
});
