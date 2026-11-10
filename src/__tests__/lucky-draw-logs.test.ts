import { describe, it, expect } from "vitest";
import {
  campaignReceivedLogs,
  nextReceivedLogParameters,
  readCampaignRequest,
  receivedLogTypeIds,
} from "../../supabase/functions/_shared/lucky-draw-logs";
const token = "TH-0123456789ABCDEF0123";
const cash = (patch: any = {}) => ({
  id: "log-cash",
  timestamp: 1800000000,
  details: { id: 999, title: "Money receive" },
  data: { sender: 42, money: 5000000, message: token, ...patch },
});
describe("official receive log parser", () => {
  it("matches cash token messages with boundaries and case insensitivity", () => {
    const r = campaignReceivedLogs(
      { log: [cash({ message: `entry ${token.toLowerCase()} thank you` })] },
      token,
    );
    expect(r).toEqual([
      {
        id: "log-cash",
        sender: 42,
        timestamp: 1800000000,
        kind: "cash",
        message: `entry ${token.toLowerCase()} thank you`,
        assets: [{ quantity: 5000000 }],
      },
    ]);
  });
  it("ignores outgoing logs, unrelated money, partial tokens and unrelated activity", () => {
    expect(
      campaignReceivedLogs(
        {
          log: [
            cash({ message: token + "A" }),
            cash({ message: "other" }),
            { ...cash(), details: { title: "Money send" } },
            { ...cash(), details: { title: "Faction deposit money" } },
          ],
        },
        token,
      ),
    ).toEqual([]);
  });
  it("reads the current item array format and preserves all received assets", () => {
    const item = {
      ...cash(),
      details: { title: "Item receive" },
      data: {
        sender: 42,
        message: token,
        items: [
          { id: 206, qty: 5, uid: 0 },
          { id: 1, qty: 2, uid: 0 },
        ],
      },
    };
    expect(campaignReceivedLogs({ log: [item] }, token)[0].assets).toEqual([
      { item_id: 206, quantity: 5 },
      { item_id: 1, quantity: 2 },
    ]);
  });
  it("fails closed on malformed matching logs, unsupported layouts and fractional money", () => {
    for (const row of [
      cash({ money: 1.5 }),
      cash({ money: -1 }),
      cash({ sender: 0 }),
      cash({ money: 1, amount: 2 }),
      {
        ...cash(),
        details: { title: "Item receive" },
        data: { sender: 42, message: token, items: { 206: [1, 0] } },
      },
    ])
      expect(() => campaignReceivedLogs({ log: [row] }, token)).toThrow();
    expect(() => campaignReceivedLogs({}, token)).toThrow();
  });
});

describe("safe receive-log pagination", () => {
  it("follows only the official log endpoint and strips credentials from next links", () => {
    const current = { from: "100", to: "300", limit: "100" };
    expect(
      nextReceivedLogParameters(
        {
          _metadata: {
            links: {
              next: "https://api.torn.com/v2/user/log?to=200&key=never-forward",
            },
          },
        },
        current,
      ),
    ).toEqual({ from: "100", to: "200", limit: "100" });
    for (const next of [
      "https://other.example/v2/user/log?to=200",
      "https://api.torn.com/v2/user/attacks?to=200",
      "https://api.torn.com/v2/user/log?to=300",
      "https://api.torn.com/v2/user/log?to=200&limit=1000",
    ])
      expect(() =>
        nextReceivedLogParameters({ _metadata: { links: { next } } }, current),
      ).toThrow();
    expect(
      nextReceivedLogParameters(
        { _metadata: { links: { next: null } } },
        current,
      ),
    ).toBeNull();
  });
  it("resolves receive event IDs from official metadata rather than assuming numeric IDs", () => {
    expect(
      receivedLogTypeIds({
        logtypes: [
          { id: 12, title: "Money receive" },
          { id: 13, title: "Item receive" },
          { id: 14, title: "Money send" },
        ],
      }),
    ).toBe("12,13");
    expect(() => receivedLogTypeIds({ logtypes: [] })).toThrow();
  });
  it("bounds the public request body and accepts only a campaign identifier", async () => {
    const campaign = "00000000-0000-4000-8000-000000000001";
    expect(
      await readCampaignRequest(
        new Request("https://example.test", {
          method: "POST",
          body: JSON.stringify({ campaign }),
        }),
      ),
    ).toEqual({ campaign });
    await expect(
      readCampaignRequest(
        new Request("https://example.test", {
          method: "POST",
          body: "x".repeat(3000),
        }),
      ),
    ).rejects.toThrow("large");
  });
});

describe("nanosecond log pagination", () => {
  it("uses the documented cursor without to, including a full final-looking page", () => {
    const current = { from: "100", to: "300", limit: "100" };
    const payload = {
      log: Array(100).fill({}),
      _metadata: { links: { next: null }, nanostamp: "300000000000000000" },
    };
    expect(nextReceivedLogParameters(payload, current)).toEqual({
      from: "100",
      limit: "100",
      nanostamp: "300000000000000000",
    });
    expect(() =>
      nextReceivedLogParameters(
        { ...payload, _metadata: { links: { next: null } } },
        current,
      ),
    ).toThrow("nanosecond cursor");
    expect(() => nextReceivedLogParameters({}, current)).toThrow("metadata");
  });
});
