import { adminClient, scheduled, preflight, json } from "../_shared/http.ts";
import { syncLuckyDrawPage } from "../_shared/lucky-draw-sync.ts";
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const admin = adminClient();
    if (!(await scheduled(req, admin)))
      return json({ error: "Unauthorized" }, 401);
    const jobs = await admin.rpc("claim_lucky_draw_jobs");
    if (jobs.error) throw jobs.error;
    const stop = Date.now() + 45000;
    let completed = 0,
      failed = 0;
    for (const job of jobs.data ?? []) {
      if (Date.now() > stop) break;
      let success = false;
      try {
        // A prior completed sync can be finalized even if the upstream API is down.
        const prior = await admin.rpc("finalize_lucky_draw", {
          draw_id: job.campaign_id,
        });
        if (prior.error) throw prior.error;
        if (["drawn", "already_drawn"].includes(prior.data.state)) {
          success = true;
          completed++;
          continue;
        }
        for (let page = 0; page < 3 && Date.now() < stop; page++) {
          const result = await syncLuckyDrawPage(
            admin,
            job.owner_id,
            job.campaign_id,
          );
          if (!result.has_more) break;
        }
        const drawn = await admin.rpc("finalize_lucky_draw", {
          draw_id: job.campaign_id,
        });
        if (drawn.error) throw drawn.error;
        success = true;
        completed++;
      } catch {
        failed++;
      } finally {
        await admin.rpc("finish_lucky_draw_job", {
          draw_id: job.campaign_id,
          token: job.token,
          success,
        });
      }
    }
    return json({ completed, failed });
  } catch {
    return json({ error: "Unable to process automatic lucky draws." }, 503);
  }
});
