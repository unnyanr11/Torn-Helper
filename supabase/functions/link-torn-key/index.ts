import { adminClient, authenticate, preflight, json } from "../_shared/http.ts";
import { retentionPolicyError } from "../_shared/torn-key-policy.ts";
import { tornEncryptionSecret } from "../_shared/torn-key-storage.ts";
import { encrypt } from "../_shared/crypto.ts";
import { LoginError, verifiedTornIdentity } from "../_shared/torn-login.ts";
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
    const policyError=retentionPolicyError(persist);if(policyError)return json({error:policyError},409);
    const secret=await tornEncryptionSecret(admin,Deno.env.get("TORN_KEY_ENCRYPTION_KEY"));
    const verified = await verifiedTornIdentity(apiKey);
    const basic = { id: verified.id, name: verified.name };
    const access = verified.access;
    const current = await admin
      .from("linked_torn_accounts")
      .select("torn_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (current.error) throw current.error;
    if (current.data && Number(current.data.torn_id) !== Number(basic.id))
      return json(
        {
          error:
            "This key belongs to a different Torn identity. Sign out and use Continue with Torn to switch accounts.",
        },
        409,
      );
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
    let encrypted: string;
    try { encrypted = await encrypt(apiKey, secret ?? ""); }
    catch { throw new LoginError(503,"Encrypted backend key storage is not configured. Ask the site owner to configure it before linking."); }
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
    const result = await admin.from("encrypted_credentials").upsert(
      { user_id: user.id, provider: "torn", encrypted_key: encrypted },
      { onConflict: "user_id,provider" },
    );
    if (result.error) throw result.error;
    return json({
      linked: true,
      torn_id: basic.id,
      torn_name: basic.name,
      key_access_level: access,
      persistent: true,
    });
  } catch (error) {
    return json(
      {
        error:
          error instanceof LoginError
            ? error.message
            : "Unable to link key. Please retry shortly.",
      },
      error instanceof LoginError ? error.status : 503,
    );
  }
});
