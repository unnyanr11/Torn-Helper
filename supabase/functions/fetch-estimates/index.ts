import { adminClient, authenticate, preflight, json } from "../_shared/http.ts";
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  const admin = adminClient();
  const user = await authenticate(req, admin);
  if (!user) return json({ error: "Unauthorized" }, 401);
  return json(
    {
      error:
        "Third-party estimates are not enabled: API terms, per-user credentials, attribution, caching and redistribution rights must be verified. Existing authorized evidence remains available in Stat Intelligence.",
    },
    409,
  );
});
