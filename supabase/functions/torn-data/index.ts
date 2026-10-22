import { adminClient, authenticate, json, preflight } from "../_shared/http.ts";
import { personalStatValues } from "../_shared/history.ts";
import { LoginError } from "../_shared/torn-login.ts";
import { resolveRefreshKey } from "../_shared/live-refresh.ts";
import {
  boundedJson,
  compileTornRequest,
  fetchTornPage,
  nextPageParameters,
  requestHash,
  tornDataFailure,
} from "../_shared/torn-data.ts";
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const admin = adminClient(),
      user = await authenticate(req, admin);
    if (!user) return json({ error: "Sign in to view Torn data." }, 401);
    const body = await boundedJson(req, 8192);
    const compiled = compileTornRequest(
      body?.endpoint_id,
      body?.parameters ?? {},
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
        "Tracking is paused. Resume it in Settings before fetching Torn data.",
      );
    const budget = await admin.rpc("consume_torn_data_budget", {
      owner_id: user.id,
      cost: body.apiKey === undefined ? 1 : 3,
    });
    if (budget.error) throw budget.error;
    if (budget.data !== true)
      throw new LoginError(
        429,
        "Request limit reached. Wait a minute before loading more Torn data.",
      );
    const key = await resolveRefreshKey(
      admin,
      user.id,
      body.apiKey,
      Deno.env.get("TORN_KEY_ENCRYPTION_KEY"),
    );
    if (Object.values(compiled.parameters).some((value) => value.includes(key)))
      throw new LoginError(400, "Do not put an API key in section parameters.");
    const hash = await requestHash(compiled.endpoint.id, compiled.parameters);
    const cached = await admin
      .from("torn_data_cache")
      .select("payload,fetched_at")
      .eq("user_id", user.id)
      .eq("request_hash", hash)
      .maybeSingle();
    if (cached.error) throw cached.error;
    const fresh =
      cached.data && Date.now() - Date.parse(cached.data.fetched_at) < 60000;
    const payload = fresh
      ? cached.data!.payload
      : await fetchTornPage(compiled.path, key);
    let fetched_at = fresh ? cached.data!.fetched_at : "";
    if (!fresh) {
      const saved = await admin.rpc("store_torn_data", {
        owner_id: user.id,
        hash,
        endpoint: compiled.endpoint.id,
        params: compiled.parameters,
        observation: payload,
      });
      if (saved.error) throw saved.error;
      fetched_at = saved.data;
    }
    let history_recorded = false;
    let history_warning: string | undefined;
    if (!fresh && compiled.endpoint.path === "/user/personalstats" &&
        (!compiled.parameters.cat || compiled.parameters.cat === "all") &&
        !compiled.parameters.timestamp && !compiled.parameters.stat) {
      const recorded = await admin.rpc("record_personal_snapshot", {
        owner_id: user.id,
        observed_at: fetched_at,
        values_json: personalStatValues(payload as Record<string, unknown>),
      });
      if (recorded.error) history_warning = "Data loaded, but numeric history could not be recorded. Try again later.";
      else history_recorded = recorded.data === true;
    }
    return json({
      history_recorded,
      ...(history_warning ? { history_warning } : {}),
      payload,
      fetched_at,
      cached: Boolean(fresh),
      source: "official Torn API",
      endpoint_id: compiled.endpoint.id,
      parameters: compiled.parameters,
      next_parameters: nextPageParameters(payload, compiled),
    });
  } catch (error) {
    const failure = tornDataFailure(error);
    return json({ error: failure.error }, failure.status);
  }
});
