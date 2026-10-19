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
./scripts/deploy-functions.sh
```

Or manually:

```bash
supabase functions deploy verify-loss-payment
supabase functions deploy verify-loss-funding
```

## Schedule the cron jobs

pg_cron jobs are configured via migration (see `0055_loss_payment_automation.sql` and the cron setup SQL):

- `verify-loss-funding` — every 5 minutes
- `verify-loss-payment` — every 2 minutes

Verify the service role key setting:

```sql
select current_setting('app.settings.service_role_key', true);
```

## Regenerate API capability registry

```bash
node scripts/generate-capabilities.mjs
```

## Companion userscript

Install via Tampermonkey from `/torn-helper.user.js` (served from `public/`).

## PWA

The app is installable as a PWA (manifest.json + service worker in public/).

## Public API

Read-only, keyless JSON API at `/functions/v1/public-api`.

## Loss Marketplace

Full buy/sell workflow for verified losses with Xanax-based funding detection, attack-log verification, settlement ledger, and disputes.

## Status

- [x] Steps 1-75: app shell through operator dashboard
- [x] Payout workflow integration tests
- [x] Edge Function integration tests
- [x] Deploy script

All data in Demo Mode is seeded sample data and is never presented as live.
