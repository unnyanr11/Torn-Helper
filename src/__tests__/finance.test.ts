import { describe, it, expect } from "vitest";
import {
  amortize,
  analyzeCashFlows,
  monthlyDate,
  validDate,
} from "../lib/finance";
describe("fixed whole-dollar mortgage schedules", () => {
  it("anchors month-end dates without drifting after February", () => {
    expect([0, 1, 2, 3].map((i) => monthlyDate("2024-01-31", i))).toEqual([
      "2024-01-31",
      "2024-02-29",
      "2024-03-31",
      "2024-04-30",
    ]);
    expect(monthlyDate("2025-01-30", 1)).toBe("2025-02-28");
  });
  it("preserves principal exactly and ends at zero with rounding", () => {
    for (const principal of [1, 100, 1000000, 1000000000000])
      for (const annualBps of [0, 1, 500, 10000]) {
        const rows = amortize({
          principal,
          annualBps,
          months: 360,
          firstDue: "2026-01-31",
        });
        expect(rows.reduce((s, r) => s + r.principal, 0)).toBe(principal);
        expect(rows[rows.length - 1].balance).toBe(0);
        expect(
          rows.every(
            (r) =>
              r.principal > 0 &&
              r.amount === r.principal + r.interest &&
              Number.isSafeInteger(r.amount),
          ),
        ).toBe(true);
      }
  });
  it("rejects invalid dates, fractions and unreasonable terms", () => {
    expect(validDate("2026-02-30")).toBe(false);
    for (const patch of [
      { principal: 1.1 },
      { annualBps: NaN },
      { annualBps: 10001 },
      { months: 0 },
      { months: 601 },
      { firstDue: "2026-02-30" },
    ])
      expect(() =>
        amortize({
          principal: 1000,
          annualBps: 0,
          months: 12,
          firstDue: "2026-01-31",
          ...patch,
        }),
      ).toThrow();
  });
});
describe("dated multi-asset cash flow calculations", () => {
  it("uses dates for annual return and discounting, rather than annualizing a simple ratio", () => {
    const s = analyzeCashFlows(
      [
        { date: "2025-01-01", asset: "Stock", amount: -1000 },
        { date: "2026-01-01", asset: "Stock", amount: 1100 },
      ],
      10,
    );
    expect(s.roi).toBeCloseTo(10);
    expect(s.xirr).toBeCloseTo(10);
    expect(s.npv).toBeCloseTo(0);
    expect(s.recoveryDate).toBe("2026-01-01");
  });
  it("groups assets and includes fees and later investments", () => {
    const s = analyzeCashFlows([
      { date: "2025-01-01", asset: "Stock", amount: -1000 },
      { date: "2025-02-01", asset: "Property", amount: -100 },
      { date: "2025-03-01", asset: "Stock", amount: -10 },
      { date: "2026-01-01", asset: "Stock", amount: 1500 },
      { date: "2026-01-01", asset: "Property", amount: 120 },
    ]);
    expect(s.invested).toBe(1110);
    expect(s.profit).toBe(510);
    expect(s.assets.find((a) => a.asset === "Stock")?.profit).toBe(490);
    expect(s.xirr).toBeGreaterThan(40);
  });
  it("does not invent an IRR for ambiguous or same-day flows", () => {
    expect(
      analyzeCashFlows([
        { date: "2025-01-01", asset: "A", amount: -100 },
        { date: "2026-01-01", asset: "A", amount: 230 },
        { date: "2027-01-01", asset: "A", amount: -132 },
      ]).xirr,
    ).toBeNull();
    expect(
      analyzeCashFlows([
        { date: "2025-01-01", asset: "A", amount: -100 },
        { date: "2025-01-01", asset: "A", amount: 110 },
      ]).xirr,
    ).toBeNull();
  });
  it("supports losses and rejects undefined input", () => {
    expect(
      analyzeCashFlows([
        { date: "2025-01-01", asset: "A", amount: -100 },
        { date: "2026-01-01", asset: "A", amount: 50 },
      ]).xirr,
    ).toBeCloseTo(-50);
    expect(() =>
      analyzeCashFlows([
        { date: "2025-01-01", asset: "A", amount: -100 },
        { date: "2026-02-30", asset: "A", amount: 110 },
      ]),
    ).toThrow();
    expect(() =>
      analyzeCashFlows(
        [
          { date: "2025-01-01", asset: "A", amount: -100 },
          { date: "2026-01-01", asset: "A", amount: 110 },
        ],
        -100,
      ),
    ).toThrow();
  });
});

it("keeps long dated returns numerically stable and rejects overflowing NPV", () => {
  const flows = [
    { date: "2000-01-01", asset: "A", amount: -100 },
    { date: "2100-01-01", asset: "A", amount: -100 },
    { date: "2200-01-01", asset: "A", amount: 400 },
  ];
  const r = analyzeCashFlows(flows);
  expect(Number.isFinite(r.xirr)).toBe(true);
  expect(r.xirr).toBeGreaterThan(0);
  expect(() => analyzeCashFlows(flows, -99.99)).toThrow(/NPV range/);
});
