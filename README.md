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

## Status (delivery checklist)

- [x] Steps 1-46: app shell through assistant (see git history for full list)
- [x] Step 47: public API (public-api Edge Function with /glossary, /capabilities, / endpoints; Public API docs page)
- [x] Step 48: PWA (manifest.json, sw.js service worker, registration in App)
- [x] Step 49: admin cost dashboard (AdminCostDashboard page aggregating api_usage by endpoint with cost totals)
- [x] Step 50: competitor coverage matrix (static comparison vs TornTools/YATA/TornStats; CompetitorMatrix page)

All planned features are now delivered. All data in Demo Mode is seeded sample data and is never presented as live.
