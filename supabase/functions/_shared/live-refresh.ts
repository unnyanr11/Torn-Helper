import { decrypt } from "./crypto.ts";
import { LoginError, verifiedTornIdentity } from "./torn-login.ts";
import { tornGet, TornApiError } from "./torn.ts";

// Each selection is independent: a Minimal/Custom key must not lose all data
// because it cannot read the Limited-access battle-stat selection.
export async function collectOverview(
  apiKey: string,
  fetcher: typeof fetch = fetch,
) {
  const names = ["bars", "cooldowns", "travel", "battlestats", "personalstats"];
  const results = await Promise.allSettled(
    names.map((name) => tornGet(`/user/${name}`, apiKey, fetcher)),
  );
  const payload: Record<string, unknown> = {};
  const warnings: string[] = [];
  results.forEach((result, i) => {
    const name = names[i];
    if (result.status === "fulfilled") {
      const value = result.value[name] ?? result.value;
      if (value && typeof value === "object") payload[name] = value;
      else warnings.push(`${name}: Torn returned no data.`);
    } else {
      const error = result.reason;
      if (
        error instanceof TornApiError &&
        [2, 10, 13].includes(error.code ?? -1)
      )
        throw error;
      warnings.push(
        error instanceof TornApiError && error.code !== null
          ? `${name}: unavailable for this key (Torn code ${error.code}). Check its selections/access level.`
          : `${name}: temporarily unavailable. Retry shortly.`,
      );
    }
  });
  if (!Object.keys(payload).length)
    throw new LoginError(503, warnings.join(" "));
  if (warnings.length) payload._warnings = warnings;
  return payload;
}

export async function resolveRefreshKey(
  admin: { from(table: string): any },
  userId: string,
  supplied: unknown,
  secret: string | undefined,
  fetcher: typeof fetch = fetch,
) {
  const linked = await admin
    .from("linked_torn_accounts")
    .select("torn_id,revoked_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (linked.error) throw linked.error;
  if (!linked.data || linked.data.revoked_at)
    throw new LoginError(
      409,
      "Link an active Torn identity in Settings first.",
    );
  if (supplied !== undefined) {
    if (typeof supplied !== "string" || !/^[A-Za-z0-9]{16}$/.test(supplied))
      throw new LoginError(400, "Enter a valid 16-character Torn API key.");
    const identity = await verifiedTornIdentity(supplied, fetcher);
    if (identity.id !== Number(linked.data.torn_id))
      throw new LoginError(
        403,
        "Use a key belonging to your signed-in Torn identity.",
      );
    return supplied;
  }
  const credential = await admin
    .from("encrypted_credentials")
    .select("encrypted_key")
    .eq("user_id", userId)
    .eq("provider", "torn")
    .maybeSingle();
  if (credential.error) throw credential.error;
  if (!credential.data)
    throw new LoginError(
      409,
      "Your identity is linked, but no key was retained. Enter a request-only key on Overview or store an encrypted key in Settings.",
    );
  if (!secret)
    throw new LoginError(
      503,
      "Encrypted key storage is not configured. Use a request-only key on Overview.",
    );
  try {
    return await decrypt(credential.data.encrypted_key, secret);
  } catch {
    throw new LoginError(
      503,
      "The stored key cannot be decrypted. Use a request-only key or replace the encrypted key in Settings.",
    );
  }
}

export function refreshFailure(error: unknown) {
  if (error instanceof LoginError)
    return { status: error.status, error: error.message };
  if (error instanceof TornApiError)
    return {
      status: error.code !== null ? 400 : 503,
      error:
        error.code !== null
          ? `Torn rejected this request (code ${error.code}). Check that the key is active and allows the selected data.`
          : "Torn is temporarily unavailable. Retry shortly.",
    };
  return {
    status: 503,
    error: "Unable to refresh this feed. Please retry shortly.",
  };
}
