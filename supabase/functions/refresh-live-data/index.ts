import { adminClient, authenticate, preflight, json } from "../_shared/http.ts";
import { decrypt } from "../_shared/crypto.ts";
import { personalStatValues } from "../_shared/history.ts";
import { tornGet } from "../_shared/torn.ts";
const endpoints: Record<string, string> = {
  travel: "/user/travel",
  stocks: "/torn/stocks",
  market: "/torn/items",
  company: "/user/job",
  overview: "/user?selections=bars,cooldowns,travel,battlestats,personalstats",
};
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const admin = adminClient();
    const user = await authenticate(req, admin);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { feed_type } = await req.json();
    if (!Object.hasOwn(endpoints, feed_type))
      return json({ error: "Unsupported feed" }, 400);
    const { data: profile } = await admin
      .from("profiles")
      .select("tracking_paused")
      .eq("id", user.id)
      .single();
    if (profile?.tracking_paused)
      return json({ error: "Tracking paused" }, 409);
    const { data: cache } = await admin
      .from("live_feed_cache")
      .select("*")
      .eq("user_id", user.id)
      .eq("feed_type", feed_type)
      .maybeSingle();
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
    const { data: cred } = await admin
      .from("encrypted_credentials")
      .select("encrypted_key")
      .eq("user_id", user.id)
      .eq("provider", "torn")
      .single();
    if (!cred) return json({ error: "Link your Torn key" }, 400);
    const payload = await tornGet(
      endpoints[feed_type],
      await decrypt(
        cred.encrypted_key,
        Deno.env.get("TORN_KEY_ENCRYPTION_KEY")!,
      ),
    );
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
  } catch {
    return json(
      {
        error:
          "Unable to refresh this feed. Check the required key permissions.",
      },
      503,
    );
  }
});
