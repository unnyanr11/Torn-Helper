import { tornGet } from "./torn.ts";
import { encrypt } from "./crypto.ts";
type Result<T> = PromiseLike<{ data: T; error: unknown }>;
export interface LoginAdmin {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: number,
      ): { maybeSingle(): Result<{ user_id: string } | null> };
    };
  };
  rpc(name: string, args: Record<string, unknown>): Result<unknown>;
  auth: {
    admin: {
      createUser(attributes: {
        email: string;
        email_confirm: boolean;
        app_metadata: Record<string, unknown>;
      }): Result<{ user: { id: string } | null }>;
      deleteUser(id: string): Result<unknown>;
      getUserById(id: string): Result<{
        user: { id: string; email?: string; banned_until?: string } | null;
      }>;
      generateLink(attributes: { type: "magiclink"; email: string }): Result<{
        user: { id: string } | null;
        properties: { hashed_token?: string } | null;
      }>;
    };
  };
}
export class LoginError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function verifiedTornIdentity(
  apiKey: string,
  fetcher: typeof fetch = fetch,
) {
  if (!/^[a-zA-Z0-9]{16}$/.test(apiKey))
    throw new LoginError(400, "Enter a valid 16-character Torn API key.");
  let identity, info;
  try {
    [identity, info] = await Promise.all([
      tornGet("/user/basic", apiKey, fetcher),
      tornGet("/key/info", apiKey, fetcher),
    ]);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Torn API rejected request")
    )
      throw new LoginError(
        401,
        "Torn did not accept this key. Check that it is active and has the required access.",
      );
    throw error;
  }
  const basic = identity.profile ?? identity.basic;
  if (
    !Number.isSafeInteger(Number(basic?.id)) ||
    Number(basic.id) <= 0 ||
    Number(info.info?.user?.id) !== Number(basic.id) ||
    typeof basic.name !== "string" ||
    !basic.name.trim() ||
    basic.name.length > 100
  )
    throw new LoginError(401, "Unable to verify Torn key ownership.");
  const access = info.info.access?.type;
  if (
    !["Minimal Access", "Limited Access", "Full Access", "Custom"].includes(
      access,
    )
  )
    throw new LoginError(
      401,
      "Use a Minimal, Limited or Custom Torn key for sign-in; public-only keys are not accepted.",
    );
  return {
    id: Number(basic.id),
    name: basic.name,
    access: [
      "Public Only",
      "Minimal Access",
      "Limited Access",
      "Full Access",
      "Custom",
    ].includes(access)
      ? access
      : "Custom",
  };
}
export async function loginWithTorn(
  admin: LoginAdmin,
  apiKey: string,
  persist: boolean,
  secret: string | undefined,
  fetcher: typeof fetch = fetch,
  onStage: (stage: string) => void = () => {},
) {
  onStage("verify_torn");
  const identity = await verifiedTornIdentity(apiKey, fetcher);
  // Encrypt before creating anything: configuration errors cannot leave half-created accounts.
  onStage("encrypt_key");
  let ciphertext: string | null = null;
  if (persist) {
    try {
      ciphertext = await encrypt(apiKey, secret ?? "");
    } catch {
      throw new LoginError(
        503,
        "Encrypted key storage is not configured. Turn off key retention to sign in, or ask the site owner to configure it.",
      );
    }
  }
  onStage("lookup_identity");
  const lookup = await admin
    .from("linked_torn_accounts")
    .select("user_id")
    .eq("torn_id", identity.id)
    .maybeSingle();
  if (lookup.error) throw lookup.error;
  let proposed = lookup.data?.user_id as string | undefined,
    created: string | undefined;
  try {
    if (!proposed) {
      // Random, non-deliverable internal alias prevents email-address squatting. Never derived from client input.
      onStage("create_account");
      const result = await admin.auth.admin.createUser({
        email: `${crypto.randomUUID()}@torn-login.invalid`,
        email_confirm: true,
        app_metadata: { identity_provider: "torn", torn_id: identity.id },
      });
      if (result.error || !result.data.user)
        throw result.error ?? new Error("Account creation failed");
      proposed = result.data.user.id;
      created = proposed;
    }
    onStage("complete_identity");
    const complete = await admin.rpc("complete_torn_login", {
      player_id: identity.id,
      proposed_user: proposed,
      player_name: identity.name,
      access_level: identity.access,
      persist_key: persist,
      ciphertext,
    });
    if (complete.error || typeof complete.data !== "string")
      throw complete.error ?? new Error("Identity completion failed");
    const canonical = complete.data;
    if (created && canonical !== created) {
      const removed = await admin.auth.admin.deleteUser(created);
      if (removed.error) throw removed.error;
      created = undefined;
    }
    // The mapping may now own real account data; never delete this account on later errors.
    created = undefined;
    onStage("load_account");
    const user = await admin.auth.admin.getUserById(canonical);
    if (user.error || !user.data.user?.email)
      throw user.error ?? new Error("Account unavailable");
    const banned = (user.data.user as { banned_until?: string }).banned_until;
    if (banned && Date.parse(banned) > Date.now())
      throw new LoginError(403, "This app account is unavailable.");
    onStage("create_session");
    const link = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: user.data.user.email,
    });
    if (
      link.error ||
      link.data.user?.id !== canonical ||
      !link.data.properties?.hashed_token
    )
      throw link.error ?? new Error("Session identity mismatch");
    // Only the one-time session exchange token leaves the server, never the Torn key or admin credential.
    return {
      token_hash: link.data.properties.hashed_token,
      type: "magiclink" as const,
      torn_id: identity.id,
      torn_name: identity.name,
      persistent: persist,
    };
  } catch (error) {
    // A transport error can arrive after the mapping transaction committed. Only
    // clean up a new alias when a PostgreSQL error proves the transaction rolled back.
    const code = (error as { code?: unknown })?.code;
    if (created && typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) {
      await admin.auth.admin.deleteUser(created);
    }
    throw error;
  }
}
export async function boundedLoginBody(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw new LoginError(400, "Request body required.");
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 4096) {
      await reader.cancel();
      throw new LoginError(413, "Request too large.");
    }
    parts.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    all.set(part, offset);
    offset += part.length;
  }
  let body;
  try {
    body = JSON.parse(new TextDecoder().decode(all));
  } catch {
    throw new LoginError(400, "Invalid request body.");
  }
  if (
    !body ||
    typeof body.apiKey !== "string" ||
    !/^[a-zA-Z0-9]{16}$/.test(body.apiKey) ||
    typeof body.persist !== "boolean"
  )
    throw new LoginError(
      400,
      "Enter a 16-character Torn key and choose whether to retain it.",
    );
  return { apiKey: body.apiKey, persist: body.persist };
}
export async function fingerprint(value: string, serverSecret: string) {
  if (!serverSecret) throw new Error("Rate limiter configuration missing");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(serverSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode("tcc-login:" + value),
  );
  return [...new Uint8Array(digest)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
