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

## Deploy Edge Functions

```bash
supabase functions deploy link-torn-key
supabase functions deploy refresh-targets
supabase functions deploy refresh-live-data
supabase functions deploy evaluate-alerts
supabase functions deploy analyze-war
```

## Schedule the alert job

pg_cron job `evaluate-alerts` runs every 5 minutes (see migration 0016_cron_evaluate_alerts.sql).

## Regenerate API capability registry

```bash
node scripts/generate-capabilities.mjs
```

## Status (delivery checklist)

- [x] Steps 1-31: app shell, capability registry, schema/RLS, key linking, planner, targets, war room, payouts, losses, travel/markets, company/properties, racing, community, live feeds, alerts, alliances, watched factions, recruitment, gym, activity, graffiti, exports, war analyzer, compare players, leaderboards, ROI, PI mortgages, bounties, stat catalog, custom stats, native stat intelligence
- [x] Step 32: stat growth charts (native SVG time-series for gym gains and custom numeric columns; Stat Growth UI)
- [x] Step 33: spy report import & per-target stat storage (spy_reports table, bulk CSV-style import, owner RLS; Spy Reports UI)
- [x] Step 34: war hit counter (war_hits table, per-attacker leaderboard, owner RLS; War Hits UI)
- [x] Step 35: crime pass-rate tracker (crime_logs table, per-crime pass-rate aggregation, owner RLS; Crime Tracker UI)
- [x] Step 36: build detection (Stat Intelligence classifies stat distribution from spy reports when available)
- [ ] Pending: flight tracker, fine-grained activity tracker, hospital-timer dibs, target pools, Tornipedia glossary, image uploads for graffiti, Discord, web push/email, companion userscript, assistant, public API, PWA, admin cost dashboard, competitor coverage matrix

All data in Demo Mode is seeded sample data and is never presented as live.
