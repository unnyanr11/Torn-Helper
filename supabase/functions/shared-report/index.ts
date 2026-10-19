import { adminClient, preflight, json } from "../_shared/http.ts";
import { shareIsActive, redactReport } from "../_shared/reports.ts";
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const { token } = await req.json();
    if (typeof token !== "string" || !/^[a-f0-9]{32}$/.test(token))
      return json({ error: "Report not found" }, 404);
    const admin = adminClient();
    const { data: grant, error } = await admin
      .from("report_share_grants")
      .select("snapshot_id,expires_at,revoked,audience")
      .eq("token", token)
      .maybeSingle();
    if (error || !grant || !shareIsActive(grant))
      return json(
        { error: "This report is unavailable, revoked or expired" },
        404,
      );
    const { data: snapshot } = await admin
      .from("report_snapshots")
      .select("title,data,created_at")
      .eq("id", grant.snapshot_id)
      .maybeSingle();
    if (!snapshot) return json({ error: "Report not found" }, 404);
    return json({
      ...snapshot,
      data: redactReport(snapshot.data),
      source: "explicitly shared report snapshot",
      expires_at: grant.expires_at,
    });
  } catch {
    return json({ error: "Report unavailable" }, 404);
  }
});
