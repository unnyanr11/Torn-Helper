# Torn Command Center

Free, mobile-first Torn City companion built with React + TypeScript (Vite) and a neumorphic UI. Backend: Supabase (planned).

## Run

```bash
npm install
npm run dev
```

## Regenerate API capability registry

```bash
node scripts/generate-capabilities.mjs
```

This fetches Torn's official OpenAPI spec (https://www.torn.com/swagger/openapi.json) and writes `src/api/generated-capabilities.json`. Generated entries are unverified until reviewed.

## Status (delivery checklist)

- [x] Step 1: app shell, neumorphic theme (dark/light), navigation, labelled demo Overview
- [x] Step 2: capability registry from Torn OpenAPI (typed registry, verified v2 seed entries, generator script, API Usage page)
- [ ] Step 3: Supabase schema, Auth, RLS
- [ ] Step 4: key linking Edge Function with encryption + disclosure table
- [ ] Step 5: planner and levelling lists
- [ ] Later phases: targets, war room, payouts, losses, travel, markets, etc.

All data in Demo Mode is seeded sample data and is never presented as live.
