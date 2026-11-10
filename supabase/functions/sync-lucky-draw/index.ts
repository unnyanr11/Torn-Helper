import { adminClient, authenticate, json, preflight } from "../_shared/http.ts";
import { resolveRefreshKey } from "../_shared/live-refresh.ts";
import {
  campaignReceivedLogs,
  nextReceivedLogParameters,
  readCampaignRequest,
  receivedLogTypeIds,
} from "../_shared/lucky-draw-logs.ts";
import { tornGet, TornApiError } from "../_shared/torn.ts";
import { LoginError } from "../_shared/torn-login.ts";
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const admin = adminClient(),
      user = await authenticate(req, admin);
    if (!user) return json({ error: "Sign in first." }, 401);
    let body;
    try {
      body = await readCampaignRequest(req);
    } catch {
      throw new LoginError(
        400,
        "Choose a campaign using a request smaller than 2KB.",
      );
    }
    const owned = await admin
      .from("lucky_draw_campaigns")
      .select("host_user_id")
      .eq("id", body.campaign)
      .eq("host_user_id", user.id)
      .maybeSingle();
    if (owned.error) throw owned.error;
    if (!owned.data)
      throw new LoginError(
        403,
        "Only the host can read campaign received logs.",
      );
    const profile = await admin
      .from("profiles")
      .select("tracking_paused")
      .eq("id", user.id)
      .single();
    if (profile.error) throw profile.error;
    if (profile.data.tracking_paused)
      throw new LoginError(
        409,
        "Resume tracking in Settings before syncing received logs.",
      );
    const budget = await admin.rpc("consume_torn_data_budget", {
      owner_id: user.id,
      cost: 2,
    });
    if (budget.error) throw budget.error;
    if (budget.data !== true)
      throw new LoginError(
        429,
        "Request limit reached. Wait a minute and retry.",
      );
    const job = await admin.rpc("prepare_lucky_draw_sync", {
      owner_id: user.id,
      draw_id: body.campaign,
    });
    if (job.error) throw job.error;
    if (job.data.idle) return json({ has_more: false, idle: true });
    const key = await resolveRefreshKey(
      admin,
      user.id,
      undefined,
      Deno.env.get("TORN_KEY_ENCRYPTION_KEY"),
    );
    const catalogue = await tornGet("/torn/logtypes", key);
    const logTypes = receivedLogTypeIds(catalogue);
    const payload = await tornGet(
      "/user/log?" +
        new URLSearchParams({ ...job.data.parameters, log: logTypes }),
      key,
    );
    let next;
    try {
      next = nextReceivedLogParameters(payload, job.data.parameters);
    } catch {
      throw new LoginError(
        502,
        "Torn returned unsupported log pagination; coverage was not marked complete.",
      );
    }
    let events;
    try {
      events = campaignReceivedLogs(payload, job.data.token);
    } catch (error) {
      throw new LoginError(
        502,
        error instanceof Error
          ? error.message
          : "Unsupported received-log page.",
      );
    }
    const recorded = await admin.rpc("record_lucky_draw_log_page", {
      owner_id: user.id,
      draw_id: body.campaign,
      expected_parameters: job.data.parameters,
      next_parameters: next,
      events,
    });
    if (recorded.error) throw recorded.error;
    return json(recorded.data);
  } catch (error) {
    if (error instanceof LoginError)
      return json({ error: error.message }, error.status);
    if (error instanceof TornApiError) {
      if ([7, 16].includes(error.code ?? -1))
        return json(
          {
            error:
              "The host key needs Full Access or Custom user/log permission for the received log types.",
          },
          403,
        );
      if ([5, 8, 14].includes(error.code ?? -1))
        return json(
          {
            error: "Torn request quota reached. Wait a minute before retrying.",
          },
          429,
        );
    }
    return json(
      { error: "Unable to sync received logs. Check the host key and retry." },
      503,
    );
  }
});
