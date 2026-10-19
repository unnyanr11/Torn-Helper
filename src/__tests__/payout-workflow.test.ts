import { describe, it, expect } from "vitest";
import { calculatePayout, MemberInput } from "../lib/payout";
const members: MemberInput[] = [
  {
    id: "a",
    name: "A",
    points: 3,
    weight: 1,
    bonus: 0,
    reimbursement: 0,
    adjustment: 0,
  },
  {
    id: "b",
    name: "B",
    points: 1,
    weight: 3,
    bonus: 0,
    reimbursement: 0,
    adjustment: 0,
  },
];
describe("payout allocation arithmetic", () => {
  for (const mode of ["equal", "proportional", "weighted", "hybrid"] as const)
    it(`${mode} conserves every unit`, () => {
      const r = calculatePayout(members, 101, mode);
      expect(r.error).toBe("");
      expect(r.allocated + r.retained).toBe(101);
      expect(r.lines.reduce((n, l) => n + l.amount_owed_cents, 0)).toBe(
        r.allocated,
      );
    });
  it("implements distinct allocation modes", () => {
    expect(
      calculatePayout(members, 100, "equal").lines.map((l) => l.share_cents),
    ).toEqual([50, 50]);
    expect(
      calculatePayout(members, 100, "proportional").lines.map(
        (l) => l.share_cents,
      ),
    ).toEqual([75, 25]);
    expect(
      calculatePayout(members, 100, "weighted").lines.map((l) => l.share_cents),
    ).toEqual([50, 50]);
    expect(
      calculatePayout(members, 100, "hybrid").lines.map((l) => l.share_cents),
    ).toEqual([63, 37]);
  });
  it("reserves bonuses before allocating", () => {
    const r = calculatePayout(
      [{ ...members[0], bonus: 20 }, members[1]],
      100,
      "equal",
    );
    expect(r.lines.map((l) => l.amount_owed_cents)).toEqual([60, 40]);
  });
  it("redistributes capped shares without exceeding caps", () => {
    const r = calculatePayout(members, 100, "proportional", {}, { a: 10 });
    expect(r.lines.map((l) => l.share_cents)).toEqual([10, 90]);
  });
  it("retains funds when all shares are capped", () => {
    const r = calculatePayout(members, 100, "equal", {}, { a: 10, b: 10 });
    expect(r.allocated).toBe(20);
    expect(r.retained).toBe(80);
  });
  it("rejects floors above pool and contradictory caps", () => {
    expect(calculatePayout(members, 10, "equal", { a: 20 }).error).toBeTruthy();
    expect(
      calculatePayout(members, 100, "equal", { a: 20 }, { a: 10 }).error,
    ).toBeTruthy();
  });
  it("handles zero points without invented proportional contribution", () => {
    const r = calculatePayout(
      members.map((m) => ({ ...m, points: 0 })),
      100,
      "proportional",
    );
    expect(r.retained).toBe(100);
  });
  it("rejects unsafe integers, duplicate members and excess adjustments", () => {
    expect(calculatePayout(members, 0.5, "equal").error).toBeTruthy();
    expect(
      calculatePayout([members[0], members[0]], 100, "equal").error,
    ).toBeTruthy();
    expect(
      calculatePayout([{ ...members[0], bonus: 200 }], 100, "equal").error,
    ).toBeTruthy();
  });
});
