import { adminClient, json, preflight } from "../_shared/http.ts";
import type { LoginAdmin } from "../_shared/torn-login.ts";
import {
  boundedLoginBody,
  fingerprint,
  loginWithTorn,
  LoginError,
} from "../_shared/torn-login.ts";
if (!Deno.env.get("TORN_KEY_ENCRYPTION_KEY")) {
  console.warn("torn_login_retention_not_configured");
}
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  let stage = "request";
  try {
    const { apiKey, persist } = await boundedLoginBody(req);
    const admin = adminClient();
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    stage = "rate_limit";
    const limited = await admin.rpc("consume_torn_login_budget", {
      ip_fingerprint: await fingerprint(
        ip,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      ),
      key_fingerprint: await fingerprint(
        apiKey,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      ),
    });
    if (limited.error) throw limited.error;
    if (limited.data !== true)
      return json(
        { error: "Too many sign-in attempts. Wait a minute and retry." },
        429,
      );
    return json(
      await loginWithTorn(
        admin as unknown as LoginAdmin,
        apiKey,
        persist,
        Deno.env.get("TORN_KEY_ENCRYPTION_KEY"),
        fetch,
        (next) => {
          stage = next;
        },
      ),
    );
  } catch (error) {
    // Log only controlled stage names and machine codes; never upstream bodies, keys or tokens.
    if (!(error instanceof LoginError) || error.status >= 500) {
      const rawCode = (error as { code?: unknown })?.code;
      console.error(
        JSON.stringify({
          event: "torn_login_failed",
          stage,
          code:
            typeof rawCode === "string" && /^[a-zA-Z0-9_]{1,50}$/.test(rawCode)
              ? rawCode
              : "unexpected",
          retention_configured: Boolean(
            Deno.env.get("TORN_KEY_ENCRYPTION_KEY"),
          ),
        }),
      );
    }
    return json(
      {
        error:
          error instanceof LoginError
            ? error.message
            : "Unable to sign in. Check your Torn key permissions or try again shortly.",
      },
      error instanceof LoginError ? error.status : 503,
    );
  }
});
