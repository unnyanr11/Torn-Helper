import { describe, it, expect, vi } from "vitest";
import { DRAW_AUDIENCES, splitPrizes } from "../lib/lucky-draw-presets";
import { prizePreview } from "../lib/lucky-draw";
vi.mock("../lib/supabase", () => ({ supabase: {} }));
describe("audience suggestions and 75 percent presets", () => {
  it("allocates 75 percent of total contributions in either layout", () => {
    expect(prizePreview(100, splitPrizes("single"))).toEqual({
      quantities: [75],
      percentage: 75,
      remainder: 25,
    });
    expect(prizePreview(100, splitPrizes("tiered"))).toEqual({
      quantities: [45, 20, 10],
      percentage: 75,
      remainder: 25,
    });
    const p = splitPrizes("tiered");
    p[0].percentage = 1;
    expect(splitPrizes("tiered")[0].percentage).toBe(45);
  });
  it("includes the requested audience groups and configurable item suggestions", () => {
    expect(DRAW_AUDIENCES.map((a) => a.id)).toEqual([
      "all",
      "new_players",
      "faction",
    ]);
    expect(DRAW_AUDIENCES.find((a) => a.id === "new_players")?.items).toContain(
      "Donator Pack",
    );
    expect(DRAW_AUDIENCES.find((a) => a.id === "faction")?.items).toContain(
      "Vicodin",
    );
  });
  it("renders public, beginner and faction choices plus both payout presets", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { CampaignForm } = await import("../pages/LuckyDraws");
    const html = renderToStaticMarkup(
      createElement(CampaignForm, { busy: false, onSave: async () => {} }),
    );
    for (const label of [
      "New players (level 1–15)",
      "Faction members only",
      "Single winner",
      "45% / 20% / 10%",
      "25% with the host",
    ])
      expect(html).toContain(label);
    expect(html).not.toContain("percentage: 40");
  });
});

describe("entry token warning", () => {
  it("warns senders and states one transfer is one entry", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { QueryClient, QueryClientProvider } = await import(
      "@tanstack/react-query"
    );
    const { default: ReceivedTransfers } = await import(
      "../components/ReceivedTransfers"
    );
    const client = new QueryClient({
      defaultOptions: { queries: { enabled: false, retry: false } },
    });
    const c = {
      id: "draw",
      entry_token: "TH-0123456789ABCDEF0123",
      entry_verification: "token",
      entry_item: "Cash",
      quantity_per_ticket: 1000000,
      max_tickets_per_player: 5,
      host_name: "Host",
      host_torn_id: 1,
    } as any;
    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client },
        createElement(ReceivedTransfers, {
          campaign: c,
          isHost: false,
          sync: null,
        }),
      ),
    );
    expect(html).toContain("any entry without the token will be lost");
    expect(html).toContain("Each verified transfer counts as one entry");
    expect(html).not.toContain("Each eligible multiple");
    client.clear();
  });
});
