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
    const { player_id } = await req.json();
    if (!Number.isSafeInteger(Number(player_id)) || Number(player_id) <= 0)
      return json({ error: "Valid player ID required" }, 400);
    const { data: profile } = await admin
      .from("profiles")
      .select("tracking_paused")
      .eq("id", user.id)
      .single();
    if (profile?.tracking_paused)
      return json({ error: "Tracking paused" }, 409);
    const { data: credential } = await admin
      .from("encrypted_credentials")
      .select("encrypted_key")
      .eq("user_id", user.id)
      .eq("provider", "torn")
      .single();
    if (!credential) return json({ error: "Link a Torn key in Settings" }, 409);
    const payload = await tornGet(
      `/user/${player_id}/profile`,
      await decrypt(
        credential.encrypted_key,
        Deno.env.get("TORN_KEY_ENCRYPTION_KEY")!,
      ),
    );
    const player = payload.profile;
    if (!player) return json({ error: "Player unavailable" }, 404);
    const observed_at = new Date().toISOString();
    const { error } = await admin
      .from("player_observations")
      .insert({
        user_id: user.id,
        torn_player_id: Number(player_id),
        status: player.status?.state,
        level: player.level,
        last_action: player.last_action?.status,
        observed_at,
      });
    if (error) throw error;
    return json({
      profile: player,
      observed_at,
      source: "official API",
      required_permission: "Public Only",
    });
  } catch {
    return json(
      { error: "Player lookup unavailable; check key permissions" },
      503,
    );
  }
});
