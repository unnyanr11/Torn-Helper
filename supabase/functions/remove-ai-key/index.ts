import { adminClient, authenticate, preflight, json } from "../_shared/http.ts";
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
    const { error } = await admin
      .from("encrypted_credentials")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", provider);
    if (error) throw error;
    if (provider === "torn") {
      const result = await admin
        .from("linked_torn_accounts")
        .update({ revoked_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (result.error) throw result.error;
    }
    return json({ success: true, provider });
  } catch {
    return json({ error: "Unable to remove credential" }, 500);
  }
});
