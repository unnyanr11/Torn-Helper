import { adminClient, authenticate, preflight, json } from "../_shared/http.ts";
import { decrypt } from "../_shared/crypto.ts";
import { tornGet } from "../_shared/torn.ts";
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const admin = adminClient();
    const user = await authenticate(req, admin);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { listId } = await req.json();
    const { data: list } = await admin
      .from("target_lists")
      .select("id")
      .eq("id", listId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!list) return json({ error: "List not found" }, 404);
    const { data: profile } = await admin
      .from("profiles")
      .select("tracking_paused")
      .eq("id", user.id)
      .single();
    if (profile?.tracking_paused)
      return json({ error: "Tracking paused in Settings" }, 409);
    const { data: cred } = await admin
      .from("encrypted_credentials")
      .select("encrypted_key")
      .eq("user_id", user.id)
      .eq("provider", "torn")
      .single();
    if (!cred) return json({ error: "Link a Torn key in Settings" }, 400);
    const apiKey = await decrypt(
      cred.encrypted_key,
      Deno.env.get("TORN_KEY_ENCRYPTION_KEY")!,
    );
    const { data: entries, error } = await admin
      .from("target_list_entries")
      .select("*")
      .eq("list_id", listId)
      .eq("excluded", false)
      .order("last_checked_at", { ascending: true, nullsFirst: true })
      .limit(20);
    if (error) throw error;
    let refreshed = 0;
    for (const entry of entries ?? []) {
      if (
        entry.last_checked_at &&
        Date.now() - Date.parse(entry.last_checked_at) < 60000
      )
        continue;
      const payload = await tornGet(
        `/user/${entry.torn_player_id}/profile`,
        apiKey,
      );
      const player = payload.profile;
      if (!player) continue;
      const status = player.status?.state ?? null,
        level = player.level ?? null;
      const update = await admin
        .from("target_list_entries")
        .update({
          status,
          level,
          player_name: player.name,
          last_checked_at: new Date().toISOString(),
        })
        .eq("id", entry.id);
      if (update.error) throw update.error;
      const observation = await admin
        .from("player_observations")
        .insert({
          user_id: user.id,
          torn_player_id: entry.torn_player_id,
          status,
          level,
          last_action: player.last_action?.status ?? null,
        });
      if (observation.error) throw observation.error;
      refreshed++;
    }
    return json({
      refreshed,
      message:
        "Refreshes up to 20 oldest targets; observations younger than one minute are reused",
    });
  } catch {
    return json(
      {
        error:
          "Unable to refresh targets. Check key permissions or retry later.",
      },
      503,
    );
  }
});
