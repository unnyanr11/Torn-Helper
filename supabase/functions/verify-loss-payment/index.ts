import {
  adminClient,
  authenticate,
  scheduled,
  preflight,
  json,
} from "../_shared/http.ts";
import { decrypt } from "../_shared/crypto.ts";
import { tornGet, normalizeAttacks, qualifies } from "../_shared/torn.ts";
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const admin = adminClient();
    const job = await scheduled(req, admin);
    const user = job ? null : await authenticate(req, admin);
    if (!job && !user) return json({ error: "Unauthorized" }, 401);
    let query = admin
      .from("loss_claims")
      .select("*, loss_contracts(*)")
      .gt("reconcile_until", new Date().toISOString())
      .order("claimed_at")
      .limit(100);
    if (user) query = query.eq("seller_user_id", user.id);
    const { data: claims, error } = await query;
    if (error) throw error;
    let verified = 0;
    const pending: string[] = [];
    const sellers = [...new Set((claims ?? []).map((c) => c.seller_user_id))];
    for (const sellerId of sellers) {
      try {
        const { data: profile } = await admin
          .from("profiles")
          .select("tracking_paused")
          .eq("id", sellerId)
          .single();
        if (profile?.tracking_paused) {
          pending.push(sellerId);
          continue;
        }
        const { data: identity } = await admin
          .from("linked_torn_accounts")
          .select("torn_id")
          .eq("user_id", sellerId)
          .is("revoked_at", null)
          .single();
        const { data: credential } = await admin
          .from("encrypted_credentials")
          .select("encrypted_key")
          .eq("user_id", sellerId)
          .eq("provider", "torn")
          .single();
        if (!identity || !credential) {
          pending.push(sellerId);
          continue;
        }
        const apiKey = await decrypt(
          credential.encrypted_key,
          Deno.env.get("TORN_KEY_ENCRYPTION_KEY")!,
        );
        const sellerClaims = (claims ?? []).filter(
          (c) => c.seller_user_id === sellerId,
        );
        const from = Math.floor(
          Math.min(
            ...sellerClaims.map((c) => new Date(c.claimed_at).getTime()),
          ) / 1000,
        );
        // Page forward by event time, using verified Torn pagination links. Never forward keys to arbitrary hosts.
        let path = `/user/attacks?from=${from}&sort=ASC&limit=100`;
        const seen = new Set<string>();
        let complete = false;
        const attacks = [];
        for (let page = 0; page < 20; page++) {
          const payload = await tornGet(path, apiKey);
          attacks.push(...normalizeAttacks(payload));
          const next = payload._metadata?.links?.next;
          if (!next) {
            complete = true;
            break;
          }
          const url = new URL(next, "https://api.torn.com");
          if (
            url.origin !== "https://api.torn.com" ||
            url.pathname !== "/v2/user/attacks" ||
            seen.has(url.href)
          )
            throw new Error("Invalid pagination");
          url.searchParams.delete("key");
          seen.add(url.href);
          path = url.pathname.replace(/^\/v2/, "") + url.search;
        }
        if (!complete) {
          pending.push(sellerId);
          continue;
        }
        attacks.sort((a, b) => a.ended - b.ended);
        for (const claim of sellerClaims) {
          const start = new Date(claim.claimed_at).getTime() / 1000,
            end = new Date(claim.expires_at).getTime() / 1000;
          for (const attack of attacks) {
            if (
              !qualifies(
                attack,
                Number(identity.torn_id),
                Number(claim.loss_contracts.target_player_id),
                start,
                end,
              )
            )
              continue;
            const result = await admin.rpc("record_loss_attack", {
              claim: claim.id,
              attack: attack.id,
              seller: attack.attacker,
              target: attack.defender,
              event_time: new Date(attack.ended * 1000).toISOString(),
              is_loss: attack.loss,
            });
            if (result.error) throw result.error;
            if (result.data) verified++;
          }
        }
      } catch {
        pending.push(sellerId);
      }
    }
    return json({
      verified,
      pending: pending.length,
      message: pending.length
        ? "Some records are pending API reconciliation"
        : "Recheck complete",
    });
  } catch {
    return json(
      {
        error:
          "Verification is temporarily unavailable; no payment has been approved",
      },
      503,
    );
  }
});
