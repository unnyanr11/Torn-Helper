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

describe("deposit and threshold presentation", () => {
  it("renders exact/range choices and threshold-controlled days", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { CampaignForm } = await import("../pages/LuckyDraws");
    const html = renderToStaticMarkup(
      createElement(CampaignForm, { busy: false, onSave: async () => {} }),
    );
    for (const label of [
      "Exact fixed amount",
      "Minimum and maximum together",
      "Minimum verified entries for a valid campaign",
      "Days open after the minimum is reached",
    ])
      expect(html).toContain(label);
  });
  it("labels exact and bounded deposits and handles a not-yet-started countdown", async () => {
    const { depositLabel, campaignStatus } = await import("../lib/lucky-draw");
    const c = {
      entry_item: "Cash",
      quantity_per_ticket: 1000000,
      maximum_deposit: 5000000,
      deposit_mode: "range",
      closes_at: null,
      drawn_at: null,
      cancelled_at: null,
    } as any;
    expect(depositLabel(c)).toContain("$1,000,000 to $5,000,000");
    expect(depositLabel({ ...c, deposit_mode: "fixed" })).toContain(
      "Exactly $1,000,000",
    );
    expect(campaignStatus(c)).toBe("Awaiting minimum entries");
  });
});

describe("sealed result presentation", () => {
  it("shows a closing-based countdown without embedding a sealed winner name", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { default: DrawRevealWindow, revealCountdown } = await import(
      "../components/DrawRevealWindow"
    );
    const closed = new Date(Date.now() - 1000).toISOString(),
      reveal = new Date(Date.parse(closed) + 48 * 3600000).toISOString();
    const c = { closes_at: closed, drawn_at: new Date().toISOString() } as any;
    const data = {
      result_state: "sealed",
      reveal_at: reveal,
      winners: [{ player_name: "Hidden winning player" }],
    } as any;
    const html = renderToStaticMarkup(
      createElement(DrawRevealWindow, {
        campaign: c,
        data,
        onReveal: () => {},
      }),
    );
    expect(html).toContain("24");
    expect(html).toContain("hours after entry closing");
    expect(html).toContain("Winner identities remain sealed");
    expect(html).not.toContain("Hidden winning player");
    expect(revealCountdown(new Date(48 * 3600000).toISOString(), 0)).toBe(
      "48h 0m 0s",
    );
  });
  it("discloses automatic processing and audited name corrections before publication", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { CampaignForm } = await import("../pages/LuckyDraws");
    const html = renderToStaticMarkup(
      createElement(CampaignForm, { busy: false, onSave: async () => {} }),
    );
    expect(html).toContain("24");
    expect(html).toContain("hours after entry closing");
    expect(html).toContain("public audit trail");
  });
});

describe("configurable release and unsealing animation", () => {
  it("shows the 24-hour minimum and seven-day maximum in campaign creation", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { CampaignForm } = await import("../pages/LuckyDraws");
    const html = renderToStaticMarkup(
      createElement(CampaignForm, { busy: false, onSave: async () => {} }),
    );
    expect(html).toContain("Winner reveal delay after entry closes");
    expect(html).toContain('min="24"');
    expect(html).toContain('max="168"');
  });
  it("does not put a winner name into the animation introduction", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { default: WinnerReveal } = await import(
      "../components/WinnerReveal"
    );
    const html = renderToStaticMarkup(
      createElement(WinnerReveal, {
        campaignId: "released",
        children: createElement("p", null, "Released winner name"),
      }),
    );
    expect(html).toContain("Unsealing the winners");
    expect(html).not.toContain("Released winner name");
  });
});
