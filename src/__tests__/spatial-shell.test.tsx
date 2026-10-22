import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SpatialShell from "../components/SpatialShell";
import { NAV } from "../nav";
import { canAccessPage } from "../lib/access";
const render = (signedIn: boolean, role: string, shared = false) =>
  renderToStaticMarkup(
    <SpatialShell
      page="Overview"
      signedIn={signedIn}
      role={role}
      shared={shared}
      onNavigate={() => {}}
    >
      <section>Workspace content</section>
    </SpatialShell>,
  );
describe("simple navigation preserves the application's access model", () => {
  it("keeps authorized tools accessible through primary navigation and a dropdown", () => {
    const html = render(true, "admin"),
      nav = html.split('aria-label="Main"')[1].split("</nav>")[0];
    for (const page of NAV.filter((page) => canAccessPage(page, true, "admin")))
      expect(nav).toContain(({ "Live Feeds": "Data browser", "Stat Growth": "Trends", "Player Intel": "Player lookup" } as Record<string,string>)[page] ?? page);
    expect(html).toContain('id="workspace-content"');
    expect(html).toContain('aria-label="More tools"');
    expect(html).not.toContain("spatial-dock");
    expect(html).not.toContain("scene-orb");
  });
  it("does not expose privileged navigation to standard or signed-out accounts", () => {
    for (const [signedIn, role] of [
      [false, "user"],
      [true, "user"],
    ] as const) {
      const html = render(signedIn, role),
        nav = html.split('aria-label="Main"')[1].split("</nav>")[0];
      for (const page of NAV.filter(
        (page) => !canAccessPage(page, signedIn, role),
      ))
        expect(nav).not.toContain(`>${page}</option>`);
    }
  });
  it("labels shared reports as published snapshots rather than a private live workspace", () => {
    const html = render(false, "user", true);
    expect(html).toContain("Published snapshot");
    expect(html).toContain("Shared snapshot");
    expect(html).toContain("Skip to content");
  });
});
