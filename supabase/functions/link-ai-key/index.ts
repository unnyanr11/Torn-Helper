import { adminClient, authenticate, preflight, json } from "../_shared/http.ts";
import { encrypt } from "../_shared/crypto.ts";
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const admin = adminClient();
    const user = await authenticate(req, admin);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { provider, api_key } = await req.json();
    if (
      !["openai", "gemini"].includes(provider) ||
      typeof api_key !== "string" ||
      api_key.length < 16 ||
      api_key.length > 512
    )
      return json({ error: "Invalid provider or key" }, 400);
    const encrypted_key = await encrypt(
      api_key,
      Deno.env.get("TORN_KEY_ENCRYPTION_KEY")!,
    );
    const { error } = await admin
      .from("encrypted_credentials")
      .upsert(
        { user_id: user.id, provider, encrypted_key },
        { onConflict: "user_id,provider" },
      );
    if (error) throw error;
    return json({ success: true, provider });
  } catch {
    return json({ error: "Unable to store credential" }, 500);
  }
});
