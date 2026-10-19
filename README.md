# Torn Command Center

Free, mobile-first Torn City companion built with React + TypeScript (Vite) and a neumorphic UI. Backend: Supabase.

## Run

```bash
npm install
npm run dev
```

## Supabase setup

1. Create a Supabase project.
2. Run the migrations in order:
   ```bash
   supabase db push
   ```
   or apply each file in `supabase/migrations/` via the SQL editor.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`.
4. Set the `TORN_KEY_ENCRYPTION_KEY` Edge Function secret (base64-encoded 32-byte key):
   ```bash
   openssl rand -base64 32
   supabase secrets set TORN_KEY_ENCRYPTION_KEY=<your-base64-key>
   ```
5. Create a public Storage bucket named `graffiti-images` for graffiti image uploads.
6. Set the AI provider secret for the war analyzer:
   ```bash
   supabase secrets set AI_PROVIDER_API_KEY=<your-openai-key>
   ```

## Deploy Edge Functions

```bash
supabase functions deploy link-torn-key
supabase functions deploy refresh-targets
supabase functions deploy refresh-live-data
supabase functions deploy evaluate-alerts
supabase functions deploy analyze-war
supabase functions deploy analyze-war-ai
supabase functions deploy public-api
```

## Schedule the alert job

pg_cron job `evaluate-alerts` runs every 5 minutes (see migration 0016_cron_evaluate_alerts.sql).

## Regenerate API capability registry

```bash
node scripts/generate-capabilities.mjs
```

## Companion userscript

Install via Tampermonkey from `/torn-helper.user.js` (served from `public/`). It adds a floating panel on torn.com with quick links to the app and a target lookup using your Torn API key (stored locally in your browser via GM storage).

## PWA

The app is installable as a PWA (manifest.json + service worker in public/). Add icon-192.png and icon-512.png to public/ for full install support.

## Public API

Read-only, keyless JSON API at `/functions/v1/public-api` with endpoints `/glossary`, `/capabilities`, and `/`. CORS-enabled.

## Loss Marketplace

Full buy/sell workflow for verified losses (spec section 7A). Contracts are direct-payment (no operator custody).

## War Payout Calculator

Full audited payout workflow (spec section 8).

## Stats Catalog

224 verified distinct metrics across 15 categories.

## TornStats Integration

Opt-in adapter with manual spy report import.

## Reports & Exports

Immutable snapshots, CSV/XLSX export, revocable share links.

## Competitor Coverage Matrix

16-feature audit table.

## Halloween Tools

Candy haul tracker, NPC timers.

## Faction Operations

Roster, chain, armory, territory.

## Faction Finance

Money requests + running ledger.

## Faction Upgrade Simulation

Respect planning per branch.

## Alliance Sharing

Scoped grants by role with instant revoke.

## Retention Trends

Join/leave/kick tracking with retention rate.

## Armory History & Loans

Armory event log + member loans.

## AI War Analyzer

Optional AI-powered war evidence summarization (OpenAI gpt-4o-mini) behind explicit user consent, with a rules-based non-AI fallback always available. AI provides recommendations only — never allocations or payment authorization (spec section 7C #17).

## Status (delivery checklist)

- [x] Steps 1-63: app shell through armory history & loans (see git history for full list)
- [x] Step 64: AI war analyzer wiring (0046 migration with ai_consents + ai_analysis_requests + RLS; analyze-war-ai Edge Function; AiWarAnalyzer page with consent toggle, AI summary, rules-based fallback)
- [x] All items from the original delivery checklist and follow-up gap list are now complete.

All data in Demo Mode is seeded sample data and is never presented as live.
