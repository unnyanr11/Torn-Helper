import { publicApiPath } from "../_shared/routes.ts";
import registry from "../_shared/generated-capabilities.json" with { type: "json" };
// Torn Command Center - public read-only API Edge Function
// Deploy: supabase functions deploy public-api

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const GLOSSARY = [
  {
    term: "Chain",
    category: "Faction",
    definition:
      "A faction-wide sequence of hits; each member hit extends the chain within a time window.",
  },
  {
    term: "Dibs",
    category: "War",
    definition:
      "A claim on a target before they leave the hospital, reserving the hit for a set window.",
  },
  {
    term: "Fair Fight",
    category: "Combat",
    definition:
      "A formula that scales respect based on the stat difference between attacker and target.",
  },
  {
    term: "FF",
    category: "Combat",
    definition: "Shorthand for Fair Fight multiplier.",
  },
  {
    term: "Glass Cannon",
    category: "Builds",
    definition:
      "A build with very high dexterity/speed but low defense; hits hard but takes damage easily.",
  },
  {
    term: "Tank",
    category: "Builds",
    definition:
      "A build with high defense and strength; absorbs damage but moves slower.",
  },
  {
    term: "Spy",
    category: "Intel",
    definition: "A report revealing another player's battle stats.",
  },
  {
    term: "Ranked War",
    category: "War",
    definition:
      "A formal war between factions with ranked scoring and rewards.",
  },
  {
    term: "Respect",
    category: "Faction",
    definition:
      "Currency earned from faction activities; spendable on faction upgrades.",
  },
  {
    term: "Bazaar",
    category: "Economy",
    definition: "A player-run shop listing items for sale.",
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "GET")
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: CORS,
    });
  const url = new URL(req.url);
  const path = publicApiPath(url.pathname);

  if (path === "/glossary") {
    return new Response(JSON.stringify({ glossary: GLOSSARY }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  if (path === "/capabilities") {
    const caps = [
      "targets",
      "compare-players",
      "leaderboards",
      "roi-calculator",
      "pi-mortgages",
      "bounties",
      "stats-catalog",
      "custom-stats",
      "stat-intelligence",
      "stat-growth",
      "spy-reports",
      "war-hits",
      "crime-tracker",
      "flight-tracker",
      "dibs",
      "target-pools",
      "tornipedia",
      "assistant",
      "discord",
      "notification-prefs",
      "alerts",
      "notifications",
      "war-room",
      "war-analyzer",
      "payouts",
      "losses",
      "travel",
      "markets",
      "stocks",
      "company",
      "properties",
      "racing",
      "community",
      "live-feeds",
      "alliances",
      "watched-factions",
      "recruitment",
      "gym",
      "activity",
      "graffiti",
      "reports",
      "api-usage",
    ];
    return new Response(
      JSON.stringify({
        capabilities: registry.capabilities,
        specVersion: registry.specVersion,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
  if (path === "/" || path === "") {
    return new Response(
      JSON.stringify({
        name: "Torn Command Center Public API",
        version: "1.0.0",
        endpoints: ["/glossary", "/capabilities"],
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
