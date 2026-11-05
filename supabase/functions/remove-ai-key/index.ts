import { adminClient, authenticate, preflight, json } from "../_shared/http.ts";
import { credentialRemovalPolicy } from "../_shared/torn-key-policy.ts";
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const admin = adminClient();
    const user = await authenticate(req, admin);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { provider } = await req.json();
    if (!["openai", "gemini", "torn"].includes(provider))
      return json({ error: "Invalid provider" }, 400);
    const policyError=credentialRemovalPolicy(provider);if(policyError)return json({error:policyError},409);
    const { error } = await admin
      .from("encrypted_credentials")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", provider);
    if (error) throw error;
    return json({ success: true, provider });
  } catch {
    return json({ error: "Unable to remove credential" }, 500);
  }
});
