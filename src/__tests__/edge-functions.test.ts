import { describe, it, expect, vi } from "vitest";
import { encrypt, decrypt } from "../../supabase/functions/_shared/crypto";
import {
  normalizeAttacks,
  qualifies,
  tornGet,
} from "../../supabase/functions/_shared/torn";
const secret = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
describe("credential encryption", () => {
  it("roundtrips encrypted keys without exposing plaintext", async () => {
    const encrypted = await encrypt("private-api-key", secret);
    expect(encrypted).not.toContain("private-api-key");
    expect(await decrypt(encrypted, secret)).toBe("private-api-key");
  });
  it("uses a fresh IV and rejects tampering", async () => {
    const first = await encrypt("key", secret),
      second = await encrypt("key", secret);
    expect(first).not.toBe(second);
    const [iv, data] = first.split(":");
    await expect(
      decrypt(iv + ":" + (data[0] === "A" ? "B" : "A") + data.slice(1), secret),
    ).rejects.toThrow();
  });
});
describe("mocked Torn API", () => {
  it("uses header authentication and keeps keys out of URLs", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ attacks: [] })));
    await tornGet("/user/attacks", "secret-key", fetcher);
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://api.torn.com/v2/user/attacks",
    );
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe(
      "ApiKey secret-key",
    );
  });
  it("treats outages and Torn error payloads as pending failures", async () => {
    await expect(
      tornGet(
        "/user/attacks",
        "key",
        vi.fn().mockResolvedValue(new Response("", { status: 503 })),
      ),
    ).rejects.toThrow(/temporarily unavailable/);
    await expect(
      tornGet(
        "/user/attacks",
        "key",
        vi
          .fn()
          .mockResolvedValue(
            new Response(
              JSON.stringify({ error: { code: 2, error: "Invalid key" } }),
            ),
          ),
      ),
    ).rejects.toThrow(/code 2/);
  });
  it("normalizes official v2 records and excludes malformed identities", () => {
    const result = normalizeAttacks({
      attacks: [
        {
          id: 123,
          attacker: { id: 1 },
          defender: { id: 2 },
          ended: 100,
          result: "Lost",
        },
        {
          id: 124,
          attacker: null,
          defender: { id: 2 },
          ended: 101,
          result: "Lost",
        },
      ],
    });
    expect(result).toEqual([
      { id: "123", attacker: 1, defender: 2, ended: 100, loss: true },
    ]);
  });
  it("verifies identity, target, outcome and event-time boundaries", () => {
    const a = { id: "1", attacker: 1, defender: 2, ended: 100, loss: true };
    expect(qualifies(a, 1, 2, 99, 101)).toBe(true);
    expect(qualifies(a, 3, 2, 99, 101)).toBe(false);
    expect(qualifies(a, 1, 3, 99, 101)).toBe(false);
    expect(qualifies({ ...a, loss: false }, 1, 2, 99, 101)).toBe(false);
    expect(qualifies(a, 1, 2, 101, 110)).toBe(false);
  });
});
