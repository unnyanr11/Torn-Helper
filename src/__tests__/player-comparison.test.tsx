import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  comparisonIds,
  fetchPlayerComparisons,
  historicStatPoints,
  COMPARISON_METRICS,
} from "../lib/player-comparison";
import { historySummary } from "../lib/history";
import { compileTornRequest } from "../../supabase/functions/_shared/torn-data";
vi.mock("../lib/supabase", () => ({ supabase: {} }));
import { ComparisonTrend } from "../pages/ComparePlayers";
const now = Date.parse("2026-10-19T16:00:00Z");
function requestMock() {
  return vi.fn(async (endpoint: string, params: Record<string, string>) => {
    // Catch mismatches between the comparison integration and the gateway's schema.
    compileTornRequest(endpoint, params);
    if (endpoint.endsWith("profile"))
      return {
        payload: {
          profile: {
            id: Number(params.id),
            name: "Player " + params.id,
            level: 20,
            status: { state: "Okay" },
          },
        },
        fetched_at: new Date(now).toISOString(),
      };
    const recent = Number(params.timestamp) > now / 1000 - 86400;
    return {
      payload: {
        personalstats: params.stat
          .split(",")
          .map((name) => ({
            name,
            value: recent ? 120 : 100,
            timestamp: Number(params.timestamp),
          })),
      },
      fetched_at: new Date(now).toISOString(),
    };
  });
}
describe("comparison presets fetch actual observations", () => {
  it("accepts only two to five distinct valid IDs", () => {
    expect(comparisonIds("123,456,123")).toEqual([123, 456]);
    for (const input of ["", "123", "123,-1", "1,2,3,4,5,6", "abc,123"])
      expect(() => comparisonIds(input)).toThrow();
  });
  it("fetches profiles and both dated stat boundaries for preset IDs/window", async () => {
    const request = requestMock();
    const rows = await fetchPlayerComparisons([123, 456], "30", request, now);
    expect(request).toHaveBeenCalledTimes(6);
    expect(rows[0].profile.name).toBe("Player 123");
    expect(rows[0].current.attackswon?.value).toBe(120);
    expect(historySummary(rows[0].metrics.attackswon).delta).toBe(20);
    const oldCall = request.mock.calls.find(
      ([endpoint, params]) =>
        endpoint.endsWith("personalstats") &&
        Number(params.timestamp) === now / 1000 - 30 * 86400,
    )!;
    expect(oldCall[1].stat.split(",")).toHaveLength(7);
    expect(oldCall[1].stat).not.toContain("strength");
    expect(rows[1].metrics.networth).toHaveLength(2);
  });
  it("keeps current values unknown when only historical values succeed", async () => {
    const base = requestMock();
    const request = vi.fn(
      async (endpoint: string, params: Record<string, string>) => {
        if (
          endpoint.endsWith("personalstats") &&
          Number(params.timestamp) === now / 1000
        )
          throw new Error("Current stats unavailable");
        return base(endpoint, params);
      },
    );
    const rows = await fetchPlayerComparisons([123, 456], "30", request, now);
    expect(rows[0].current.attackswon).toBeNull();
    expect(rows[0].metrics.attackswon).toHaveLength(1);
    expect(historySummary(rows[0].metrics.attackswon).delta).toBeNull();
    expect(rows[0].warnings[0]).toContain("Current statistics");
  });
  it("retains public profiles when historical data is unavailable", async () => {
    const base = requestMock();
    const request = vi.fn(
      async (endpoint: string, params: Record<string, string>) => {
        if (endpoint.endsWith("personalstats"))
          throw new Error("Historical statistic unavailable");
        return base(endpoint, params);
      },
    );
    const rows = await fetchPlayerComparisons([123, 456], "7", request, now);
    expect(rows[0].profile.id).toBe(123);
    expect(rows[0].metrics.attackswon).toEqual([]);
    expect(rows[0].warnings).toHaveLength(2);
  });
  it("stops on unavailable credentials/quota rather than retrying every player", async () => {
    const request = vi.fn(async () => {
      throw Object.assign(new Error("No key was retained"), { status: 409 });
    });
    await expect(
      fetchPlayerComparisons([1, 2, 3, 4, 5], "30", request, now),
    ).rejects.toThrow(/No key/);
    expect(request).toHaveBeenCalledTimes(3);
  });
  it("does not fabricate, coerce or duplicate historical records", () => {
    const payload = {
      personalstats: [
        { name: "attackswon", value: 0, timestamp: 100 },
        { name: "attackswon", value: "20", timestamp: 200 },
        { name: "attackswon", value: 25, timestamp: 0 },
        { name: "attackswon", value: 22, timestamp: Number.MAX_SAFE_INTEGER },
        { name: "networth", value: 7, timestamp: 300 },
      ],
    };
    const points = historicStatPoints([payload, payload], "attackswon");
    expect(points).toEqual([
      { time: new Date(100000).toISOString(), value: 0 },
    ]);
    expect(historySummary(points).delta).toBeNull();
  });
  it("renders dated trend observations and explicit insufficient-data states", () => {
    const first = renderToStaticMarkup(
      <ComparisonTrend label="Test" points={[]} />,
    );
    expect(first).toContain("Two distinct dated observations");
    const html = renderToStaticMarkup(
      <ComparisonTrend
        label="Attacks won"
        points={[
          { time: "2026-09-19T00:00:00Z", value: 100 },
          { time: "2026-10-19T00:00:00Z", value: 120 },
        ]}
      />,
    );
    expect(html).toContain('role="img"');
    expect(html).toContain("Intermediate changes are unknown");
    expect(COMPARISON_METRICS.map((metric) => metric.id)).not.toContain(
      "totalstats",
    );
  });
});
