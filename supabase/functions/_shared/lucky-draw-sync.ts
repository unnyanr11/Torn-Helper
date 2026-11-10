import { adminClient } from "./http.ts";
import { resolveRefreshKey } from "./live-refresh.ts";
import {
  campaignReceivedLogs,
  nextReceivedLogParameters,
  receivedLogTypeIds,
} from "./lucky-draw-logs.ts";
import { tornGet } from "./torn.ts";
import { LoginError } from "./torn-login.ts";

export async function syncLuckyDrawPage(
  admin: ReturnType<typeof adminClient>,
  owner: string,
  campaign: string,
) {
  const owned = await admin
    .from("lucky_draw_campaigns")
    .select("host_user_id")
    .eq("id", campaign)
    .eq("host_user_id", owner)
    .maybeSingle();
  if (owned.error) throw owned.error;
  if (!owned.data)
    throw new LoginError(403, "Only the host can read campaign received logs.");
  const profile = await admin
    .from("profiles")
    .select("tracking_paused")
    .eq("id", owner)
    .single();
  if (profile.error) throw profile.error;
  if (profile.data.tracking_paused)
    throw new LoginError(
      409,
      "Resume tracking in Settings before syncing received logs.",
    );
  const budget = await admin.rpc("consume_torn_data_budget", {
    owner_id: owner,
    cost: 2,
  });
  if (budget.error) throw budget.error;
  if (budget.data !== true)
    throw new LoginError(
      429,
      "Request limit reached. Wait a minute and retry.",
    );
  const job = await admin.rpc("prepare_lucky_draw_sync", {
    owner_id: owner,
    draw_id: campaign,
  });
  if (job.error) throw job.error;
  if (job.data.idle) return { has_more: false, idle: true };
  const key = await resolveRefreshKey(
    admin,
    owner,
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
      error instanceof Error ? error.message : "Unsupported received-log page.",
    );
  }
  const recorded = await admin.rpc("record_lucky_draw_log_page", {
    owner_id: owner,
    draw_id: campaign,
    expected_parameters: job.data.parameters,
    next_parameters: next,
    events,
  });
  if (recorded.error) throw recorded.error;

  return recorded.data;
}
