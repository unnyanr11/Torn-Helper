import { expect, it } from "vitest";
import { readJsonObject } from "../../supabase/functions/_shared/request-body";
const parse = (body: string) => readJsonObject(
  new Request("https://example.test", { method: "POST", body }),
  (data, status) => Response.json(data, { status }),
);
it("accepts JSON objects and rejects oversized UTF-8 bodies without a length header", async () => {
  expect(await parse('{"action":"load"}')).toEqual({ action: "load" });
  expect((await parse(JSON.stringify({ value: "界".repeat(45000) }))).status).toBe(413);
  expect((await parse("null")).status).toBe(400);
});
