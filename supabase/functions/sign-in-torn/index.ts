import { adminClient, json, preflight } from "../_shared/http.ts";
import type { LoginAdmin } from "../_shared/torn-login.ts";
import {
  boundedLoginBody,
  fingerprint,
  loginWithTorn,
  LoginError,
} from "../_shared/torn-login.ts";
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const { apiKey, persist } = await boundedLoginBody(req);
    const admin = adminClient();
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
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
      ),
    );
  } catch (error) {
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
