# Torn Command Center

React/TypeScript Torn companion with Supabase. The repository contains working manual tools alongside partial workflows; it is not a complete replacement for the services in the requirements.

The coordinated runtime repair migration has been applied to the linked Supabase project with user approval. Review [docs/IMPLEMENTATION_AUDIT.md](docs/IMPLEMENTATION_AUDIT.md) before applying it. The frontend changes depend on its schema and Edge Functions.

## Local verification

```sh
npm ci
npm run build
npm test
npm run audit:schema
```

Tests use isolated PostgreSQL through PGlite and mocked Torn responses. They do not create users, charge AI providers, or make Torn requests in the production project. `npm test` also generates `scripts/candidate-schema.json`; the schema audit checks static table and column references against that candidate, not against an applied deployment.

To check Edge Function types with Deno installed:

```sh
deno check --no-config --node-modules-dir=manual supabase/functions/*/index.ts
```

Use Node 20.19+ or 22.12+ (validated here with Node 24.19).

Copy `.env.example` to `.env.local`, enter the project's publishable key, and run `npm run dev`. The legacy `VITE_SUPABASE_ANON_KEY` variable is also accepted. Never put a service-role key or provider secret in a `VITE_` variable. Supabase Auth sessions are distinct from Torn API keys.

## Deployment order

1. Approve and apply only `supabase/migrations/20261019053830_repair_runtime_security_and_marketplaces.sql` to the audited existing project.
2. Verify database grants, RPCs and Realtime publication. Retain the old application until the coordinated deployment is ready.
3. Configure a base64-encoded 32-byte `TORN_KEY_ENCRYPTION_KEY` in Edge Function secrets. The key is never sent to clients. AI uses each user's own key; there is no global AI credential. Model overrides are optional.
4. Set `TCC_SCHEMA_REPAIR_APPLIED=yes` and run `npm run deploy:functions`. Each private handler validates its own user or scoped job token; the static public API and token-based report viewer have explicitly public behavior.
5. Run staging acceptance checks before publishing the matching frontend and then verify production authentication, RLS, scheduled jobs and signed-in workflows.

Do **not** blindly run `supabase db push` or reset this existing project. The historical numbered migrations contain duplicate definitions and differ from the deployed schema. The tested repair targets the captured current schema; a clean baseline migration remains a separate task.

## Data and limitations

- Torn's API is read-only. Gameplay and payments remain manual.
- Loss contracts use direct payment. Custody funding is disabled until real operators, verified transfer evidence, valuation rules and a reviewed operating policy exist.
- Loss verification uses event timestamps, global attack deduplication, transactional reservations, a ten-minute reconciliation window and audited manual settlement.
- AI processing requires provider-specific consent and that user's encrypted OpenAI/Gemini key.
- Missing stats stay unknown. Level/activity do not establish private battle stats.
- Third-party adapters are blocked until access, data rights and terms are verified. Authorized manual imports remain available.
- Generated API documentation covers 234 current OpenAPI v2 read endpoints across nine groups. It does not fetch all of them. v1-only capability coverage still requires review.
- The competitor matrix keeps partial and dependency-blocked features visible; an existing screen does not count as full delivery.

See [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) for the supplied specification and [src/data/competitors.ts](src/data/competitors.ts) for the coverage matrix.
