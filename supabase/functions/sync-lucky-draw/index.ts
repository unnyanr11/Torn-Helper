import { adminClient, authenticate, json, preflight } from "../_shared/http.ts";
import { readCampaignRequest } from "../_shared/lucky-draw-logs.ts";
import { syncLuckyDrawPage } from "../_shared/lucky-draw-sync.ts";
import { TornApiError } from "../_shared/torn.ts";
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
    const result = await syncLuckyDrawPage(admin, user.id, body.campaign);
    if (!result.has_more) {
      const done = await admin.rpc("finalize_lucky_draw", {
        draw_id: body.campaign,
      });
      if (done.error) throw done.error;
    }
    return json(result);
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
