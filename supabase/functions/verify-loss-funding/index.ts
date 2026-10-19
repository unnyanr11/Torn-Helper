import { adminClient, authenticate, preflight, json } from "../_shared/http.ts";
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  const admin = adminClient();
  const user = await authenticate(req, admin);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const { data } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!["admin", "payment_operator"].includes(data?.role ?? ""))
    return json({ error: "Operator required" }, 403);
  return json(
    {
      error:
        "Custody funding is disabled. Contracts use direct payment. A verified operator account, transfer schema, valuation policy and custody operating policy are required before prepaid funding can be enabled.",
    },
    409,
  );
});
