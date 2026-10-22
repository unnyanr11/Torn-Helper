import { describe, it, expect, vi } from "vitest";
import { validateClientConfig } from "../lib/config";
import { canAccessPage } from "../lib/access";
vi.mock("../lib/supabase", () => ({ supabase: {} }));
const publishable = "sb_publishable_configuration_validation_only";
const jwt = (role: string) =>
  "eyJhbGciOiJIUzI1NiJ9." + btoa(JSON.stringify({ role })) + ".test-signature";
describe("production configuration and access boundaries", () => {
  it("accepts public client keys, preserving legacy anon compatibility", () => {
    expect(
      validateClientConfig("https://project.supabase.co/", publishable),
    ).toEqual({ url: "https://project.supabase.co", key: publishable });
    expect(
      validateClientConfig("https://project.supabase.co", jwt("anon")).key,
    ).toBe(jwt("anon"));
  });
  it("fails closed on missing, placeholder or server credentials", () => {
    for (const key of [
      "",
      undefined,
      "your_project_publishable_key",
      "sb_secret_private",
      jwt("service_role"),
      jwt("authenticated"),
      "invalid",
    ])
      expect(() =>
        validateClientConfig("https://project.supabase.co", key),
      ).toThrow();
  });
  it("rejects insecure or credential-bearing production URLs", () => {
    for (const url of [
      "",
      "http://project.supabase.co",
      "http://localhost:54321",
      "https://user:password@project.supabase.co",
      "https://project.supabase.co/rest/v1",
      "https://project.supabase.co?key=private",
    ])
      expect(() => validateClientConfig(url, publishable)).toThrow();
    expect(
      validateClientConfig("http://127.0.0.1:54321", publishable, false).url,
    ).toBe("http://127.0.0.1:54321");
  });
  it("restricts signed-out and privileged deep links, including banker/operator separation", () => {
    for (const page of [
      "Overview",
      "Targets",
      "Payouts",
      "Operator Dashboard",
      "Admin Cost Dashboard",
    ])
      expect(canAccessPage(page, false, "admin")).toBe(false);
    expect(canAccessPage("Settings", false, "user")).toBe(true);
    expect(canAccessPage("Operator Dashboard", true, "user")).toBe(false);
    expect(canAccessPage("Operator Dashboard", true, "payment_operator")).toBe(
      true,
    );
    expect(
      canAccessPage("Admin Cost Dashboard", true, "payment_operator"),
    ).toBe(false);
    expect(canAccessPage("Admin Cost Dashboard", true, "admin")).toBe(true);
  });
});

describe("production screens start without generated account or financial data", () => {
  it("renders blank financial forms and sign-in without sample balances or contributions", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { QueryClient, QueryClientProvider } = await import(
      "@tanstack/react-query"
    );
    // The Supabase module is replaced only for this isolated render test; no backend is contacted.
    const pages = await Promise.all([
      import("../pages/PayoutCalculator"),
      import("../pages/PiMortgages"),
      import("../pages/RoiCalculator"),
      import("../pages/Settings"),
    ]);
    const client = new QueryClient({
      defaultOptions: { queries: { enabled: false, retry: false } },
    });
    for (const { default: Page } of pages) {
      const html = renderToStaticMarkup(
        createElement(QueryClientProvider, { client }, createElement(Page)),
      );
      expect(html).not.toContain('type="email"');
      expect(html).not.toContain("App password");
      expect(html).not.toMatch(
        /Member [ABC]|DEMO_WIDGETS|DEMO PREVIEW/,
      );
      // Unselected numeric presets are choices, not seeded balances or contributions.
      expect(html).not.toMatch(/<option[^>]*value="(?:1000000|1100000|5|12)"[^>]*selected/);
      expect(html).not.toMatch(/<input[^>]*value="(?:1000000|1100000|5|12)"/);
    }
    client.clear();
  });
});
