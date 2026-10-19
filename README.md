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

## Deploy Edge Functions

```bash
supabase functions deploy link-torn-key
supabase functions deploy refresh-targets
supabase functions deploy refresh-live-data
supabase functions deploy evaluate-alerts
supabase functions deploy analyze-war
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

Full buy/sell workflow for verified losses (spec section 7A). Contracts are direct-payment (no operator custody). Sellers claim slots (15-min expiry), submit attack evidence (deduplicated by attack ID), and earnings flow through earned → approved → paid → reconciled. Disputes supported.

## War Payout Calculator

Full audited payout workflow (spec section 8). Four modes (equal/proportional/weighted/hybrid), caps with iterative redistribution, floors with infeasibility detection, largest-remainder integer rounding, draft→locked→approved→paid→reconciled state machine, CSV export, and append-only audit log.

## Stats Catalog

224 verified distinct metrics across 15 categories (battle, personal, financial, crime, faction, war, travel, company, property, racing, education, items, social, awards, health). Searchable with category filter, favourites (localStorage), tooltips, units, and source labels (official-api/derived/manual).

## TornStats Integration

Opt-in adapter (spec section 7C #13). Connect with a TornStats API token (stored per-user), import spy reports manually via JSON paste (works without live API access), view import history with provenance, and disconnect/revoke. Live API lookup requires verified TornStats API access.

## Reports & Exports

Immutable report snapshots with CSV and genuine XLSX export (formula-injection sanitized via cell prefixing), plus revocable 7-day expiring share links with unique tokens.

## Competitor Coverage Matrix

Per-feature audit table (spec section 7C #16) covering 16 features across TornStats, TornTools, YATA, and TornWise with source URL, date checked, freemium status, acceptance test, and blocker visibility. Searchable/filterable in-app.

## Halloween Tools

Seasonal event tracker (spec Phase 22): log candy/chocolate/plushie/flower hauls with source, view totals by type and grand total, approximate NPC spawn timers, and manage recent haul history. Backed by `halloween_candy_log` table with owner-only RLS.

## Faction Operations

Roster management (add/update/remove members with Torn ID, name, role, level), chain state tracking (current/best/timeout), armory inventory (item/quantity/total value with aggregate), and territory control toggling. Backed by four tables (faction_members, faction_chain_state, faction_armory, faction_territory) all with owner-only RLS.

## Status (delivery checklist)

- [x] Steps 1-57: app shell through Halloween tools (see git history for full list)
- [x] Step 58: Faction operations depth (0040 migration with 4 tables + RLS; FactionOps page with roster/chain/armory/territory)
- [x] All pending items from the original delivery checklist are now complete.

All data in Demo Mode is seeded sample data and is never presented as live.
