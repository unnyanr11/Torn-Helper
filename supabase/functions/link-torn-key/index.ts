import { adminClient, authenticate, preflight, json } from "../_shared/http.ts";
import { encrypt } from "../_shared/crypto.ts";
import { tornGet } from "../_shared/torn.ts";
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const admin = adminClient();
    const user = await authenticate(req, admin);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { apiKey, persist = true } = await req.json();
    if (typeof apiKey !== "string" || !/^[a-zA-Z0-9]{16}$/.test(apiKey))
      return json({ error: "Enter a 16-character Torn key" }, 400);
    const [identity, info] = await Promise.all([
      tornGet("/user/basic", apiKey),
      tornGet("/key/info", apiKey),
    ]);
    const basic = identity.profile ?? identity.basic;
    const keyInfo = info.info;
    if (!basic?.id || Number(keyInfo?.user?.id) !== Number(basic.id))
      return json({ error: "Could not validate key ownership" }, 400);
    const allowed = [
      "Public Only",
      "Minimal Access",
      "Limited Access",
      "Full Access",
      "Custom",
    ];
    const access = allowed.includes(keyInfo.access?.type)
      ? keyInfo.access.type
      : "Custom";
    const { data: existing, error: lookupError } = await admin
      .from("linked_torn_accounts")
      .select("user_id")
      .eq("torn_id", basic.id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing && existing.user_id !== user.id)
      return json(
        { error: "This Torn identity is already linked to another account" },
        409,
      );
    const secret = Deno.env.get("TORN_KEY_ENCRYPTION_KEY")!;
    const encrypted = persist ? await encrypt(apiKey, secret) : null;
    const { error } = await admin.from("linked_torn_accounts").upsert(
      {
        user_id: user.id,
        torn_id: basic.id,
        torn_name: basic.name,
        key_access_level: access,
        revoked_at: null,
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;
    const result = encrypted
      ? await admin
          .from("encrypted_credentials")
          .upsert(
            { user_id: user.id, provider: "torn", encrypted_key: encrypted },
            { onConflict: "user_id,provider" },
          )
      : await admin
          .from("encrypted_credentials")
          .delete()
          .eq("user_id", user.id)
          .eq("provider", "torn");
    if (result.error) throw result.error;
    return json({
      linked: true,
      torn_id: basic.id,
      torn_name: basic.name,
      key_access_level: access,
      persistent: persist,
    });
  } catch {
    return json(
      {
        error:
          "Unable to link key. Check its permissions and server encryption configuration.",
      },
      400,
    );
  }
});
