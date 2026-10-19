import { TornApiError } from "../../supabase/functions/_shared/torn";
import { describe, it, expect, vi } from "vitest";
import {
  endpoints,
  tornDataFailure,
  compileTornRequest,
  requestHash,
  fetchTornPage,
  boundedJson,
  nextPageParameters,
} from "../../supabase/functions/_shared/torn-data";
const key = "AbCdEf0123456789";
const id = (path: string) => endpoints.find((item) => item.path === path)!.id;
function sample(schema: any): string {
  if (schema.enum) return String(schema.enum[0]);
  if (schema.oneOf || schema.anyOf)
    return sample((schema.oneOf ?? schema.anyOf)[0]);
  if (schema.type === "array") return sample(schema.items ?? {});
  if (schema.type === "boolean") return "true";
  if (["integer", "number"].includes(schema.type))
    return String(schema.minimum ?? 1);
  return "123";
}
describe("complete official data gateway", () => {
  it("can compile all documented GET endpoints including every required parameter", () => {
    expect(endpoints).toHaveLength(234);
    expect(new Set(endpoints.map((c) => c.group)).size).toBe(9);
    for (const endpoint of endpoints) {
      const values = Object.fromEntries(
        endpoint.parameters
          .filter((p) => p.required)
          .map((p) => [p.name, sample(p.schema)]),
      );
      const request = compileTornRequest(endpoint.id, values);
      expect(request.path).not.toMatch(/[{}]/);
      expect(request.path.startsWith(`/${endpoint.group}`)).toBe(true);
    }
  });
  it("rejects arbitrary URLs, credential parameters and path traversal", () => {
    for (const endpoint of ["https://evil.test", "/user/profile", "../../user"])
      expect(() => compileTornRequest(endpoint, {})).toThrow();
    for (const name of ["key", "apiKey", "authorization", "unexpected"])
      expect(() =>
        compileTornRequest(id("/user/profile"), { [name]: key }),
      ).toThrow();
    for (const value of [
      "../123",
      "https://evil.test",
      "123?key=secret",
      "123%2fprofile",
    ])
      expect(() =>
        compileTornRequest(id("/user/{id}/profile"), { id: value }),
      ).toThrow();
  });
  it("validates required fields, enums and documented numeric limits", () => {
    expect(() => compileTornRequest(id("/user/{id}/profile"), {})).toThrow(
      /Enter id/,
    );
    expect(() =>
      compileTornRequest(id("/user/attacks"), { limit: "999999999" }),
    ).toThrow();
    expect(() =>
      compileTornRequest(id("/user/attacks"), { sort: "random" }),
    ).toThrow();
    expect(
      compileTornRequest(id("/user/attacks"), { limit: "10", sort: "ASC" })
        .path,
    ).toContain("limit=10");
  });
  it("hashes parameter order consistently without involving an API key", async () => {
    expect(await requestHash("endpoint", { to: "2", from: "1" })).toBe(
      await requestHash("endpoint", { from: "1", to: "2" }),
    );
    expect(await requestHash("endpoint", { from: "1" })).not.toBe(
      await requestHash("another", { from: "1" }),
    );
  });
  it("authenticates in headers and removes echoed keys and secret pagination values", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            money: 123,
            api_key: key,
            _metadata: {
              links: {
                next: `https://api.torn.com/v2/user/attacks?to=2&key=${key}`,
              },
            },
          }),
        ),
    );
    const data = await fetchTornPage("/user/money", key, fetcher as any);
    expect((fetcher.mock.calls[0] as any)[0]).toBe(
      "https://api.torn.com/v2/user/money",
    );
    expect((fetcher.mock.calls[0] as any)[1].headers.Authorization).toBe(
      `ApiKey ${key}`,
    );
    expect(JSON.stringify(data)).not.toContain(key);
    expect(data._metadata.links.next).not.toContain("key=");
    expect(data.money).toBe(123);
  });
  it("rejects upstream permission failures without caching fabricated data", async () => {
    await expect(
      fetchTornPage(
        "/user/money",
        key,
        vi.fn(
          async () => new Response(JSON.stringify({ error: { code: 16 } })),
        ) as any,
      ),
    ).rejects.toMatchObject({ code: 16 });
  });
  it("bounds request and upstream response bodies", async () => {
    await expect(
      boundedJson(
        new Request("https://app.test", {
          method: "POST",
          body: "x".repeat(8193),
        }),
        8192,
      ),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      fetchTornPage(
        "/user/money",
        key,
        vi.fn(async () => new Response("x".repeat(2097153))) as any,
      ),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("follows only validated pagination parameters for the selected endpoint", () => {
    const request = compileTornRequest(id("/user/attacks"), { limit: "10" });
    const payload = (next: string) => ({ _metadata: { links: { next } } });
    expect(
      nextPageParameters(
        payload(
          "https://api.torn.com/v2/user/attacks?limit=10&to=100&key=secret",
        ),
        request,
      ),
    ).toEqual({ limit: "10", to: "100" });
    expect(
      nextPageParameters(
        payload("https://evil.test/v2/user/attacks?to=100"),
        request,
      ),
    ).toBeNull();
    expect(
      nextPageParameters(
        payload("https://api.torn.com/v2/user/money?to=100"),
        request,
      ),
    ).toBeNull();
    expect(
      nextPageParameters(
        payload("https://api.torn.com/v2/user/attacks?limit=999999999"),
        request,
      ),
    ).toBeNull();
  });
});

it("distinguishes quota exhaustion from denied access and invalid keys", () => {
  expect(tornDataFailure(new TornApiError(5)).status).toBe(429);
  expect(tornDataFailure(new TornApiError(null, 429)).status).toBe(429);
  expect(tornDataFailure(new TornApiError(16)).status).toBe(403);
  expect(tornDataFailure(new TornApiError(18)).status).toBe(401);
  expect(tornDataFailure(new Error("private-secret")).error).not.toContain(
    "private-secret",
  );
});
