import { adminClient, authenticate, preflight, json } from "../_shared/http.ts";
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const admin = adminClient();
    const user = await authenticate(req, admin);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { war_id } = await req.json();
    const { data: war } = await admin
      .from("wars")
      .select("*")
      .eq("id", war_id)
      .eq("user_id", user.id)
      .single();
    if (!war) return json({ error: "War not found" }, 404);
    const { data: claims, error } = await admin
      .from("target_claims")
      .select("torn_player_id")
      .eq("war_id", war_id)
      .eq("user_id", user.id);
    if (error) throw error;
    const ids = [...new Set((claims ?? []).map((c) => c.torn_player_id))];
    const { data: observations, error: obsError } = ids.length
      ? await admin
          .from("player_observations")
          .select("*")
          .eq("user_id", user.id)
          .in("torn_player_id", ids)
      : { data: [], error: null };
    if (obsError) throw obsError;
    const observed = new Set((observations ?? []).map((o) => o.torn_player_id))
      .size;
    const online = (observations ?? []).filter(
      (o) => o.last_action?.toLowerCase() === "online",
    ).length;
    const analysis = {
      generated_at: new Date().toISOString(),
      coverage: ids.length ? observed / ids.length : 0,
      online_rate: observations?.length ? online / observations.length : 0,
      insights: [
        `${ids.length} explicitly claimed targets; ${observed} have observations.`,
        `${observations?.length ?? 0} collected samples; observed online rate is not a continuous activity history.`,
        "No missed-hit attribution can be inferred without assignments and availability evidence.",
      ],
    };
    const result = await admin
      .from("wars")
      .update({ analysis })
      .eq("id", war_id);
    if (result.error) throw result.error;
    return json({ analysis });
  } catch {
    return json(
      { error: "Unable to analyze authorized war observations" },
      503,
    );
  }
});
