import { afterEach, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("../lib/supabase", () => ({ supabase: {} }));
import LiveFeeds from "../pages/LiveFeeds";
import TornDataShortcut from "../components/TornDataShortcut";
afterEach(() => vi.unstubAllGlobals());
it("renders all data groups without fetching or retaining a key by default", () => {
  vi.stubGlobal("location", { hash: "#Live%20Feeds" });
  const html = renderToStaticMarkup(<LiveFeeds />);
  expect(html).toContain("234");
  for (const category of [
    "Faction",
    "Company",
    "Markets",
    "Properties",
    "Racing",
    "Forums",
    "Game reference data",
  ])
    expect(html).toContain(category);
  expect(html).toContain('type="password"');
  expect(html).not.toContain('checked=""');
});
it("opens endpoint deep links with the required ID fields", () => {
  vi.stubGlobal("location", {
    hash: "#Live%20Feeds?section=v2-user-%7BcrimeId%7D-crimes",
  });
  const html = renderToStaticMarkup(<LiveFeeds />);
  expect(html).toContain("crimeId");
  expect(html).toContain("Section options and pagination");
  expect(html).toContain("Fetch selected data");
});
it("connects native trackers to their connected data group", () => {
  expect(renderToStaticMarkup(<TornDataShortcut page="Stocks" />)).toContain(
    "Overview?area=Investments",
  );
});
