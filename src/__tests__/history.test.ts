import { describe, it, expect } from "vitest";
import { historySummary } from "../lib/history";
import { personalStatValues } from "../../supabase/functions/_shared/history";
describe("personal history without invented data", () => {
  it("flattens only finite numeric leaves of supported stats", () => {
    expect(
      personalStatValues({
        battlestats: {
          strength: 10,
          defense: null,
          speed: "20",
          modifiers: { strength: 1.2 },
          secret: 123,
        },
        personalstats: { attacks: { total: 5 }, items: [1, 2], bad: Infinity },
        cash: 999,
        api_key: "private",
      }),
    ).toEqual({
      "battlestats.strength": 10,
      "battlestats.modifiers.strength": 1.2,
      "personalstats.attacks.total": 5,
    });
  });
  it("keeps no-data and insufficient-data changes unknown", () => {
    expect(historySummary([]).delta).toBeNull();
    expect(
      historySummary([{ time: "2026-01-01", value: 0 }]).percent,
    ).toBeNull();
  });
  it("uses chronological boundaries, zero baselines and explicit gaps", () => {
    const s = historySummary([
      { time: "2026-01-04", value: 20 },
      { time: "2026-01-01", value: 0 },
      { time: "invalid", value: 100 },
      { time: "2026-01-02", value: 10 },
    ]);
    expect(s.delta).toBe(20);
    expect(s.percent).toBeNull();
    expect(s.gaps).toEqual([
      { from: "2026-01-02", to: "2026-01-04", hours: 48 },
    ]);
  });
});
