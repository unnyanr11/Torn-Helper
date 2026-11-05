import { describe, it, expect, vi } from "vitest";
import {
  loginWithTorn,
  verifiedTornIdentity,
  boundedLoginBody,
  fingerprint,
} from "../../supabase/functions/_shared/torn-login";
import {retentionPolicyError,credentialRemovalPolicy,encryptionSecretConfigured} from "../../supabase/functions/_shared/torn-key-policy";
import { decrypt } from "../../supabase/functions/_shared/crypto";
const apiKey = "AbCdEf0123456789";
const secret = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));
function upstream(id = 123, owner = 123, access = "Limited Access") {
  return vi.fn(
    async (url: any) =>
      new Response(
        JSON.stringify(
          String(url).endsWith("/user/basic")
            ? { profile: { id, name: "Verified Torn player" } }
            : { info: { user: { id: owner }, access: { type: access } } },
        ),
      ),
  ) as unknown as typeof fetch;
}
function backend(
  existing = false,
  canonical = "created-user",
  sessionUser = canonical,
) {
  const data = { user_id: "existing-user" };
  const api = {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: existing ? data : null,
            error: null,
          }),
        }),
      }),
    })),
    rpc: vi.fn(async () => ({
      data: existing ? "existing-user" : canonical,
      error: null,
    })),
    auth: {
      admin: {
        createUser: vi.fn(async () => ({
          data: { user: { id: "created-user" } },
          error: null,
        })),
        deleteUser: vi.fn(async () => ({ data: {}, error: null })),
        getUserById: vi.fn(async (id: string) => ({
          data: { user: { id, email: `${id}@torn-login.invalid` } },
          error: null,
        })),
        generateLink: vi.fn(async () => ({
          data: {
            user: { id: existing ? "existing-user" : sessionUser },
            properties: { hashed_token: "one-time-session-token" },
          },
          error: null,
        })),
      },
    },
  };
  return api;
}
describe("Torn key-based app sessions", () => {
  it("checks upstream ownership before any auth-account operations", async () => {
    const admin = backend();
    await expect(
      loginWithTorn(admin as any, apiKey, true, secret, upstream(123, 999)),
    ).rejects.toThrow(/ownership/);
    expect(admin.from).not.toHaveBeenCalled();
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
    await expect(
      verifiedTornIdentity(apiKey, upstream(123, 123, "Public Only")),
    ).rejects.toThrow(/public-only/);
  });
  it("creates a random internal alias and returns only a one-time exchange token", async () => {
    const admin = backend();
    const result = await loginWithTorn(
      admin as any,
      apiKey, true, secret,
      upstream(),
    );
    const created = admin.auth.admin.createUser.mock.calls[0] as any;
    expect(created[0].email).toMatch(/^[a-f0-9-]{36}@torn-login\.invalid$/);
    expect(created[0]).not.toHaveProperty("password");
    expect(created[0].app_metadata.torn_id).toBe(123);
    expect(result).toEqual({
      token_hash: "one-time-session-token",
      type: "magiclink",
      torn_id: 123,
      torn_name: "Verified Torn player",
      persistent: true,
    });
    expect(JSON.stringify(result)).not.toContain(apiKey);
    expect((admin.rpc.mock.calls[0] as any)[1].ciphertext).not.toContain(apiKey);
  });
  it("reuses existing mapped users without requiring their email or password", async () => {
    const admin = backend(true);
    await loginWithTorn(admin as any, apiKey, true, secret, upstream());
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
    expect(admin.auth.admin.getUserById).toHaveBeenCalledWith("existing-user");
  });
  it("retains only authenticated encryption when explicitly requested", async () => {
    const admin = backend();
    await loginWithTorn(admin as any, apiKey, true, secret, upstream());
    const args = (admin.rpc.mock.calls[0] as any)[1];
    expect(args.persist_key).toBe(true);
    expect(args.ciphertext).not.toContain(apiKey);
    expect(await decrypt(args.ciphertext, secret)).toBe(apiKey);
    const broken = backend();
    await expect(
      loginWithTorn(broken as any, apiKey, true, "bad-config", upstream()),
    ).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining("Ask the site owner"),
    });
    expect(broken.auth.admin.createUser).not.toHaveBeenCalled();
  });
  it("cleans up a losing first-login race and signs in only the canonical mapping", async () => {
    const admin = backend(false, "winning-user");
    await loginWithTorn(admin as any, apiKey, true, secret, upstream());
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith("created-user");
    expect(admin.auth.admin.getUserById).toHaveBeenCalledWith("winning-user");
  });
  it("refuses mismatched session identity without deleting a committed mapping", async () => {
    const admin = backend(false, "created-user", "wrong-user");
    await expect(
      loginWithTorn(admin as any, apiKey, true, secret, upstream()),
    ).rejects.toThrow(/mismatch/);
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });
  it("bounds public request size and requires encrypted backend retention", async () => {
    const req = (body: string) =>
      new Request("https://app.invalid", { method: "POST", body });
    expect(
      await boundedLoginBody(req(JSON.stringify({ apiKey, persist: true }))),
    ).toEqual({ apiKey, persist: true });
    for (const body of [
      "{",
      "{}",
      JSON.stringify({ apiKey }),
      JSON.stringify({ apiKey, persist: false }),
      JSON.stringify({ apiKey, persist: "yes" }),
      "x".repeat(4097),
    ])
      await expect(boundedLoginBody(req(body))).rejects.toThrow();
    expect(await fingerprint(apiKey, "test-server-secret")).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });
});

it("cleans up an unlinked auth account if identity persistence fails", async () => {
  const admin = backend();
  (admin.rpc as any).mockResolvedValueOnce({
    data: null,
    error: Object.assign(new Error("transaction failed"), { code: "23514" }),
  });
  await expect(
    loginWithTorn(admin as any, apiKey, true, secret, upstream()),
  ).rejects.toThrow(/transaction failed/);
  expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith("created-user");
  expect(admin.auth.admin.generateLink).not.toHaveBeenCalled();
});
it("reports rejected upstream keys without creating an account", async () => {
  const admin = backend();
  const rejected = vi.fn(
    async () =>
      new Response(
        JSON.stringify({ error: { code: 2, error: "Incorrect key" } }),
      ),
  ) as unknown as typeof fetch;
  await expect(
    loginWithTorn(admin as any, apiKey, true, secret, rejected),
  ).rejects.toMatchObject({ status: 401 });
  expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
});

it("preserves a potentially committed mapping after an uncertain transport failure", async () => {
  const admin = backend();
  (admin.rpc as any).mockResolvedValueOnce({
    data: null,
    error: new Error("network response lost"),
  });
  await expect(
    loginWithTorn(admin as any, apiKey, true, secret, upstream()),
  ).rejects.toThrow(/network response lost/);
  expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
});

it("reports absent retention configuration without touching accounts", async () => {
  const admin = backend();
  const stages: string[] = [];
  await expect(
    loginWithTorn(admin as any, apiKey, true, undefined, upstream(), (stage) =>
      stages.push(stage),
    ),
  ).rejects.toMatchObject({
    status: 503,
    message: expect.stringContaining("Encrypted key storage is not configured"),
  });
  expect(stages).toEqual(["verify_torn", "encrypt_key"]);
  expect(admin.from).not.toHaveBeenCalled();
  expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
});

describe('mandatory backend Torn key retention',()=>{
 it('rejects retention-off sign-in before contacting Torn or modifying stored credentials',async()=>{
  const admin=backend(),fetcher=vi.fn();
  await expect(loginWithTorn(admin as any,apiKey,false,secret,fetcher)).rejects.toMatchObject({status:409});
  expect(fetcher).not.toHaveBeenCalled();expect(admin.rpc).not.toHaveBeenCalled();
 });
 it('requires retention for key linking and blocks only standalone Torn-key removal',()=>{
  expect(encryptionSecretConfigured(secret)).toBe(true);expect(encryptionSecretConfigured(undefined)).toBe(false);expect(encryptionSecretConfigured('bad-config')).toBe(false);
  expect(retentionPolicyError(false)).toContain('required while your account is active');expect(retentionPolicyError(true)).toBeNull();
  expect(credentialRemovalPolicy('torn')).toContain('delete your account');expect(credentialRemovalPolicy('openai')).toBeNull();expect(credentialRemovalPolicy('gemini')).toBeNull();
 });
});
