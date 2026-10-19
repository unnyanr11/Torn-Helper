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

## Deploy the key-linking Edge Function

```bash
supabase functions deploy link-torn-key
```

## Regenerate API capability registry

```bash
node scripts/generate-capabilities.mjs
```

## Status (delivery checklist)

- [x] Step 1: app shell, neumorphic theme (dark/light), navigation, labelled demo Overview
- [x] Step 2: capability registry from Torn OpenAPI
- [x] Step 3: Supabase schema, Auth triggers, RLS
- [x] Step 4: key linking Edge Function with encryption + disclosure table
- [x] Step 5: planner and levelling list UI screens (goals, target lists, entries) with migration 0005
- [ ] Later phases: targets intelligence, war room, payouts, losses, travel, markets, etc.

All data in Demo Mode is seeded sample data and is never presented as live.
