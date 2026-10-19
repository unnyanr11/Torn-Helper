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
```

## Schedule the alert job

pg_cron job `evaluate-alerts` runs every 5 minutes (see migration 0016_cron_evaluate_alerts.sql).

## Regenerate API capability registry

```bash
node scripts/generate-capabilities.mjs
```

## Status (delivery checklist)

- [x] Steps 1-41: app shell through fine-grained activity tracking (see git history for full list)
- [x] Step 42: graffiti image uploads (image_url column, Supabase Storage upload/display in Graffiti UI)
- [x] Step 43: Discord webhook integration (discord_webhooks table, owner RLS, add/send/delete webhooks; Discord UI)
- [x] Step 44: notification preferences (notification_preferences table, email/push opt-in toggles; Notification Prefs UI)
- [ ] Pending: companion userscript, assistant, public API, PWA, admin cost dashboard, competitor coverage matrix

All data in Demo Mode is seeded sample data and is never presented as live.
