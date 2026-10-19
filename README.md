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

- [x] Steps 1-36: app shell through build detection (see git history for full list)
- [x] Step 37: flight tracker (flight_logs table, owner RLS, log/status/delete; Flight Tracker UI)
- [x] Step 38: hospital-timer dibs (dibs table, owner RLS, claim window with expiry; Dibs UI)
- [x] Step 39: target pools (target_pools table with bigint[] target lists, owner RLS; Target Pools UI)
- [x] Step 40: Tornipedia glossary (static searchable glossary of Torn terms; Glossary UI)
- [x] Step 41: fine-grained activity tracking (5-minute auto-refresh polling option on Activity page)
- [ ] Pending: image uploads for graffiti, Discord, web push/email, companion userscript, assistant, public API, PWA, admin cost dashboard, competitor coverage matrix

All data in Demo Mode is seeded sample data and is never presented as live.
