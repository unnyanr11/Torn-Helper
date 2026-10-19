import { describe, it, expect, vi } from "vitest";
import {
  collectOverview,
  resolveRefreshKey,
  refreshFailure,
} from "../../supabase/functions/_shared/live-refresh";
import { encrypt } from "../../supabase/functions/_shared/crypto";
import { functionError } from "../lib/function-error";
const apiKey = "AbCdEf0123456789";
const secret = btoa(String.fromCharCode(...new Uint8Array(32).fill(8)));
const response = (data: unknown) => new Response(JSON.stringify(data));
function admin(
  linked: unknown = { torn_id: 123, revoked_at: null },
  credential: unknown = null,
  error: unknown = null,
) {
  return {
    from: vi.fn((table: string) => {
      const query: any = {
        select: () => query,
        eq: vi.fn(() => query),
        maybeSingle: async () => ({
          data: table === "linked_torn_accounts" ? linked : credential,
          error,
        }),
      };
      return query;
    }),
  };
}
const identity = vi.fn(async (url: any) =>
  response(
    String(url).endsWith("/user/basic")
      ? { profile: { id: 123, name: "Verified owner" } }
      : { info: { user: { id: 123 }, access: { type: "Minimal Access" } } },
  ),
) as unknown as typeof fetch;
describe("live refresh authorization and partial observations", () => {
  it("distinguishes linked identity from absent stored credential", async () => {
    await expect(
      resolveRefreshKey(admin(), "user", undefined, undefined),
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("no key was retained"),
    });
  });
  it("supports request-only collection without an encryption secret or credential write", async () => {
    const db = admin();
    expect(
      await resolveRefreshKey(db, "user", apiKey, undefined, identity),
    ).toBe(apiKey);
    expect(db.from).toHaveBeenCalledTimes(1);
    expect(db.from).toHaveBeenCalledWith("linked_torn_accounts");
  });
  it("rejects another player's key before collecting data", async () => {
    await expect(
      resolveRefreshKey(
        admin({ torn_id: 456 }),
        "user",
        apiKey,
        undefined,
        identity,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("rejects missing/revoked identities even when a stored credential exists", async () => {
    for (const linked of [
      null,
      { torn_id: 123, revoked_at: new Date().toISOString() },
    ])
      await expect(
        resolveRefreshKey(
          admin(linked, { encrypted_key: "cipher" }),
          "user",
          undefined,
          secret,
        ),
      ).rejects.toMatchObject({ status: 409 });
  });
  it("reports credential query failures rather than treating them as missing keys", async () => {
    const error = { code: "42501" };
    await expect(
      resolveRefreshKey(
        admin(undefined, null, error),
        "user",
        undefined,
        secret,
      ),
    ).rejects.toBe(error);
  });
  it("decrypts retained keys and explains absent/broken encryption configuration", async () => {
    const db = admin(undefined, {
      encrypted_key: await encrypt(apiKey, secret),
    });
    expect(await resolveRefreshKey(db, "user", undefined, secret)).toBe(apiKey);
    await expect(
      resolveRefreshKey(db, "user", undefined, undefined),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      resolveRefreshKey(
        admin(undefined, { encrypted_key: "corrupt" }),
        "user",
        undefined,
        secret,
      ),
    ).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining("cannot be decrypted"),
    });
  });
  it("keeps permitted bars when battle stats are denied, without fabricating values", async () => {
    const fetcher = vi.fn(async (url: any) => {
      const name = String(url).split("/").pop()!;
      return response(
        name === "battlestats"
          ? { error: { code: 16 } }
          : {
              [name]:
                name === "bars"
                  ? { energy: { current: 38, maximum: 100 } }
                  : {},
            },
      );
    }) as unknown as typeof fetch;
    const data = await collectOverview(apiKey, fetcher);
    expect(data.bars).toEqual({ energy: { current: 38, maximum: 100 } });
    expect(data).not.toHaveProperty("battlestats");
    expect(data._warnings).toEqual([
      expect.stringContaining("battlestats: unavailable"),
    ]);
  });
  it("fails without caching empty or revoked-key observations", async () => {
    await expect(
      collectOverview(
        apiKey,
        vi.fn(async () => response({ error: { code: 16 } })) as any,
      ),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      collectOverview(
        apiKey,
        vi.fn(async () => response({ error: { code: 2 } })) as any,
      ),
    ).rejects.toMatchObject({ code: 2 });
  });
  it("never returns internal error details to the client", () => {
    expect(refreshFailure(new Error("credential-private-data"))).toEqual({
      status: 503,
      error: "Unable to refresh this feed. Please retry shortly.",
    });
  });
});
describe("function response errors", () => {
  it("reads non-2xx JSON errors without consuming the response body", async () => {
    const context = response({
      error: "Your identity is linked, but no key was retained.",
    });
    const error = await functionError(null, { context, message: "non-2xx" });
    expect(error.message).toContain("no key was retained");
    expect(context.bodyUsed).toBe(false);
  });
  it("handles gateway JSON and network/non-JSON failures", async () => {
    expect(
      (
        await functionError(null, {
          context: response({ message: "Invalid JWT" }),
        })
      ).message,
    ).toBe("Invalid JWT");
    const error = Object.assign(new Error("Failed to fetch"), {
      context: new Response("offline"),
    });
    expect((await functionError(null, error)).message).toBe("Failed to fetch");
    expect((await functionError(null, null, "Unavailable")).message).toBe(
      "Unavailable",
    );
  });
});
