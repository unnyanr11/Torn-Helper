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
5. Set third-party estimate API keys (optional, only if you use those sources):
   ```bash
   supabase secrets set FFSCOUTER_API_KEY=<your-key>
   supabase secrets set TORNSTATS_API_KEY=<your-key>
   ```

## Deploy Edge Functions

```bash
supabase functions deploy link-torn-key
supabase functions deploy refresh-targets
supabase functions deploy refresh-live-data
supabase functions deploy evaluate-alerts
supabase functions deploy fetch-estimates
```

## Schedule the alert job

pg_cron job `evaluate-alerts` runs every 5 minutes (see migration 0016_cron_evaluate_alerts.sql).

## Regenerate API capability registry

```bash
node scripts/generate-capabilities.mjs
```

## Status (delivery checklist)

- [x] Step 1: app shell, neumorphic theme (dark/light), navigation, labelled demo Overview
- [x] Step 2: capability registry from Torn OpenAPI
- [x] Step 3: Supabase schema, Auth triggers, RLS
- [x] Step 4: key linking Edge Function with encryption + disclosure table
- [x] Step 5: planner and levelling list UI screens
- [x] Step 6: target intelligence (live status refresh, observations, estimates, alert center)
- [x] Step 7: war room (wars, 15-min target claims) and payouts (deterministic allocation, draft runs)
- [x] Step 8: losses marketplace (direct-payment contracts, claims, evidence schema, disputes)
- [x] Step 9: travel, markets, and money tools (manual observations, watchlists, stock holdings)
- [x] Step 10: company and properties (manual snapshots and property tracker)
- [x] Step 11: racing (manual race log with best-time highlight)
- [x] Step 12: community (posts with categories and moderation flag)
- [x] Step 13: live data feeds (travel, market, stocks, company via cached refresh)
- [x] Step 14: alert-evaluation job (notifications table, evaluate-alerts function, Notifications UI)
- [x] Step 15: estimate integrations (FFScouter/TornStats opt-in, fetch-estimates function, Estimates UI)
- [x] Step 16: alliances & families (alliances, members, invitations, announcements with RLS; Alliances UI)
- [x] Step 17: watched factions (up to 30 per user, priority, refresh interval, pause state, RLS; Watched Factions UI)
- [x] Step 18: recruitment scanner (requirements, candidates, review stages, match score, RLS; Recruitment UI)
- [x] Step 19: gym tracker (manual session log, stat gains, gains-per-energy summary, RLS; Gym UI)
- [x] Step 20: activity heatmaps (manual observations, hourly x weekday heatmap, polling-gap labeling, RLS; Activity UI)
- [x] Step 21: graffiti wall (alliance-scoped posts, reactions, pin/hide moderation, RLS; Graffiti UI)
- [ ] Pending: image uploads for graffiti, exports/reports, AI war analyzer, Compare Players, Leaderboards, ROI Calculator, PI Mortgages, Bounties, 217-stat catalog, custom stat columns, TornStats/FFScouter deep integration, Discord, web push/email, companion userscript, assistant, public API, PWA, admin cost dashboard, competitor coverage matrix

All data in Demo Mode is seeded sample data and is never presented as live.
