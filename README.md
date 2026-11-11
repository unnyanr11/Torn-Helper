# Torn Command Center

React/TypeScript Torn companion with Supabase. The repository contains working manual tools alongside partial workflows; it is not a complete replacement for the services in the requirements.

The coordinated runtime repair migration has been applied to the linked Supabase project with user approval. Review [docs/IMPLEMENTATION_AUDIT.md](docs/IMPLEMENTATION_AUDIT.md) before applying it. The frontend changes depend on its schema and Edge Functions.

## Local verification

Create `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, using the actual project URL and publishable key before building. Production builds reject missing configuration, placeholder values, secret/service-role keys and insecure project URLs. Runtime account screens have no demo data or sample financial records.

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

Use Node 24.x (validated here with Node 24.19); the major version is pinned for reproducible Vercel builds.

Create `.env.local`, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to your project's values, and run `npm run dev`. The legacy `VITE_SUPABASE_ANON_KEY` variable is also accepted. Never put a service-role key or provider secret in a `VITE_` variable. Supabase Auth sessions are distinct from Torn API keys.

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


## Vercel production deployment

`vercel.json` configures Vite, `npm ci`, `npm run build`, the `dist` output, response security headers and revalidation of the application shell/service worker. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the Vercel deployment environment before deploying. Never put server secrets in `VITE_` variables. Keep the Supabase Auth Site URL set to the deployed origin. Torn-key sign-in exchanges a one-time app-session token directly; users do not follow email links.

New sessions open the real sign-in flow. Deep links cannot bypass authentication or administrative role gates. The sign-in form accepts a Torn API key and automatically creates/reuses the verified Torn account. No user email or app password is required. Published shared reports remain explicitly token-accessible. Page/module loading failures show a recoverable error screen.

Discord, email/push delivery and live TornStats access are explicitly unavailable until their secure server integrations are implemented and configured. No webhook or TornStats credential entry is exposed. Authorized manual spy reports remain available. These disabled capabilities are not represented as functioning production integrations.

The removal of seeded data does **not** certify all workflows in REQUIREMENTS.md as complete. Real-account key linking, email delivery/redirects and hosted browser/mobile acceptance must be checked on your deployment. Review docs/IMPLEMENTATION_AUDIT.md for remaining functionality.


If Vercel fails with `VITE_SUPABASE_PUBLISHABLE_KEY is missing or still a placeholder`, open the project's Settings → Environment Variables and set the real public project key for the **Production** environment. A local `.env.local` file is not uploaded to Vercel. Set the same variables separately for Preview if using preview deployments. Save, then redeploy the latest main commit. Do not bypass validation or substitute a service-role/secret key.


## Torn API key sign-in

Users choose **Continue with Torn** and enter a dedicated 16-character Torn API key. `sign-in-torn` validates `/user/basic` and `/key/info` server-side before creating or reusing the unique linked Torn identity. Minimal/Limited access and suitable Custom keys are accepted; Public Only keys cannot authenticate. Existing linked app accounts retain their user IDs and data.

The backend uses Supabase Auth internally with a random, non-deliverable alias and a one-time session exchange token. No email is requested or sent, no app password is created, and no raw Torn key is returned. An explicit retention choice controls encrypted storage; declining retention removes any previously retained Torn credential. Without retention, ongoing API refresh/verification is unavailable until a key is retained in Settings.

The public login endpoint is rate-limited per server-HMAC request/key fingerprint and globally, bounds request bodies and derives identities only from verified Torn responses. Account linking is transactional and concurrent first-sign-in proposals converge on the same identity. A signed-in account cannot replace its key with one for a different Torn player; sign out to switch accounts.

The Vercel `VITE_SUPABASE_PUBLISHABLE_KEY` remains project hosting configuration. It is distinct from the individual Torn API key entered by each user. The backend's `TORN_KEY_ENCRYPTION_KEY` is needed only for encrypted retention. Keep Supabase's email provider enabled for the internal one-time token exchange; public email signups can be disabled separately because account provisioning is server-side.


### Browse all documented Torn data

Open **Live Feeds → Torn Data Browser** after signing in. All 234 documented read endpoints are connected across player, faction, company, markets, properties, racing, forums, game reference and key information. Choose a category and section, fill any required IDs/options, then fetch. Use a request-only Torn key or an encrypted key from Settings; Full Access offers the widest permissions, while faction/company roles still apply. An optional checkbox reuses a key only in page memory until you leave/reload. Next-page controls and JSON downloads expose paginated results without polling every section. Cached observations can be cleared in the browser and are included in account exports.

## Lucky draw campaigns

Open **Explore → Lucky Draws** after signing in with Torn. The existing verified Torn sign-in creates/reuses the account; campaign hosts need no separate registration.

Hosts configure the entry item, exact deposit or inclusive minimum/maximum bounds, per-player entry limit, minimum verified-entry count and final entry window (1–365 days after reaching that count), and 1–50 ordered prizes. Prizes can be percentages of the approved entry-item pool or fixed items supplied separately by the host. New campaigns default to 45%/20%/10% of total approved contributions, leaving 25% plus whole-item rounding with the host. A single-winner 75% preset is also available; custom percentages remain editable, and existing campaigns retain their original terms. Preview quantities are illustrations, never seeded contributions.

Publishing locks all rules. Entrants manually send cash or items in Torn with the campaign token as a message before closing. Only received transfers verified by the host log reader count; manual claims cannot be approved. Each qualifying transfer is one entry, even when its amount exceeds the minimum. The full verified amount contributes to the prize pool. References are unique per host across campaigns. Separate verified transfers each contribute one entry up to the per-player limit; each player can win only once. Larger amounts do not buy additional entries. After closing, every pending entry must be reviewed and there must be at least as many distinct eligible players as prizes. The server automatically finalizes one cryptographically randomized weighted draw after closing and final log verification. Results cannot be rerolled or edited. Percentage prizes round down and may be zero for small pools. Payout references and winner receipt confirmations track manual transfers; asset transfers are manual; entry receipts are verified against the host’s official received logs.

A host can permanently cancel an undrawn campaign, including an undersubscribed draw. Received items must be returned manually in Torn; refund references can be recorded per submission. Evidence is visible only to its entrant and host; terms, pool totals and results are visible to signed-in users. Shared links require sign-in.

Apply only `supabase/migrations/20261110083910_lucky_draw_campaigns.sql` to the existing linked database before deploying this frontend. Do not replay the historical migration baseline. `src/__tests__/lucky-draw.test.ts` exercises the actual PostgreSQL transitions, access restrictions, rounding, cancellation, identity changes, finalization and payout recording. Its randomness shim exists only in the isolated WASM database; production uses `extensions.gen_random_bytes` from pgcrypto.

### Audience presets

Campaign creators can choose all players, new players (level 1–15), or their faction only. Prize suggestions are grouped for each audience, using saved official catalogue names where available; no market prices or unverified item effects are advertised. Points suggestions start at 50 and remain editable. Fixed prizes are supplied separately by the host; a percentage pool always pays in the entry item.

Restricted campaigns use official server-written Torn cache observations no older than five minutes. The host’s faction is pinned at publication. Entry verifies the participant’s own profile level or faction membership, and records that snapshot; later leveling or faction changes do not revoke an already accepted entry. “Check eligibility before sending items” verifies eligibility before making a manual Torn transfer, and submission rechecks it. Clients cannot authorize themselves with supplied level/faction values. Existing campaigns default to public and keep their prize terms.

Apply `supabase/migrations/20261110091429_lucky_draw_audience_presets.sql` after the initial lucky draw migration. There are no account-cleanup or deletion-policy changes in this update.

### Cash, transfer tokens and received logs

Entry and fixed-prize selectors share the curated prize suggestions plus **Cash (Torn dollars)**. Pooled prizes stay in the entry asset; fixed prizes can use a different asset. New cash/sendable-item campaigns use automatic token verification. Points remain available as fixed prizes only; they cannot be selected for entry because Points trade-log verification is not implemented.

Each campaign receives a unique `TH-…` token. Senders include that token as a separate word in the Torn transfer message. `sync-lucky-draw` authenticates the host, respects paused tracking and request budgets, decrypts only the host’s retained key server-side, resolves Money receive/Item receive event IDs from the official log-type catalogue, and reads only those receive types. It stores matching records, never unrelated transfers or the plaintext key. Host keys need Full Access or Custom user/log permission covering both receive types.

The received-log table shows sender Torn ID, event time, received cash/items, message, log ID, entries and eligibility status. It includes wrong-asset, late, out-of-bounds and over-limit payments; those contribute zero entries. Cash-received totals include all matched cash receipts, while the prize pool includes only approved eligible entry contributions. All matched receipts are available in pages of 100. Host-only visibility covers all senders; an entrant can read only their own receipts. Public draws accept valid senders even without an app account. Restricted draw receipts wait for fresh official level/faction verification; waiting receipts must be resolved or explicitly excluded before drawing.

The host view has a five-page sync/continue button and refreshes while open. A separate server-side cron worker also processes active campaigns every minute while the page is closed. A durable cursor resumes interrupted backfills; completed checks overlap five minutes for delayed logs, and receipt IDs deduplicate retries. Nanosecond cursors prevent skipping transfers that share a second. Entries are counted only once a scan completes. A token draw cannot finalize until log coverage reaches the deadline. Unverified manual claims cannot be approved or counted. Deploy `20261110092857_lucky_draw_token_receipts.sql`, then the authenticated `sync-lucky-draw` Edge Function before publishing the frontend. The handler validates bearer sessions itself and uses `verify_jwt=false` consistently with the existing publishable-key-compatible handlers.

### One verified transfer = one entry

Migration `20261110100226_lucky_draw_one_verified_transfer.sql` enforces token verification for new campaigns and blocks manual entry submission/approval. A received transfer satisfying the published deposit rule is exactly one entry. For example, $5,000,000 sent with the correct token to a $1,000,000–$5,000,000 range campaign gives **one entry**, and the full $5,000,000 enters the pool. Exact-deposit campaigns reject both underpayments and overpayments. Separate verified transfers can each count once, subject to the configured per-player cap. Tokenless transfers never create entries. The sender-facing warning reads: “Warning: any entry without the token will be lost.” No existing production campaigns, entries or receipts were present when this change was prepared. The migration locks the campaign tables and aborts if any campaign data exists, so it cannot silently change published rules or existing entries.

### Exact/range deposits and threshold-triggered entry window

New campaigns choose **Exact fixed amount** or **Minimum and maximum together** for the cash/item entry asset. Exact deposits must equal the published amount; ranged deposits must fall within both inclusive bounds. Deposits outside the rule remain visible in received logs but give zero entries. Every qualifying token-verified transfer still counts once, and its full received amount contributes to the pool.

Creators also set **Minimum verified entries for a valid campaign** and **Days open after the minimum is reached**. The default example is 100 entries plus 7 days. `closes_at` stays null until the approved entry count reaches the minimum. Confirmation of the threshold atomically sets `threshold_reached_at` and the closing time once; further entries, duplicate logs and repeat syncs do not extend it. The countdown is based on verification time, not a claimed client time or an unsynced raw transfer. The frontend shows entry progress, when the threshold was confirmed, and the final closing date. Draws remain blocked until the required entry count, distinct-player/prize requirement, final deadline and received-log coverage are all satisfied. Before reaching the minimum the campaign remains open; the host can cancel and return transfers manually.

Apply `20261110101259_lucky_draw_deposit_bounds_and_entry_threshold.sql` before deploying this frontend. This migration adds configuration columns and preserves the one-transfer/one-entry verifier. It locks the campaign tables and aborts if campaign data exists, so published rules cannot be changed inadvertently. No existing production campaigns, entries or receipts were present during preflight. No Edge Function code change or key configuration change is needed.

### Automatic draw, sealed results and admin display-name corrections

`process-lucky-draws` is a scheduled backend worker authenticated with the existing Vault job token. It leases active campaign jobs, respects request budgets and paused tracking, resumes received-log pagination, and automatically finalizes eligible closed campaigns. It checks every minute; missing keys, API outages, incomplete log coverage or unresolved entry eligibility delay selection rather than excluding valid receipts silently. Hosts no longer need a manual finalize button. A retained Torn key with receive-log access is required for offline verification.

The random draw saves the winning Torn ID, original display name, rank and prize once. Retries return the saved result and do not reroll. `reveal_at` is constrained to **entry closing + the published reveal delay (24–168 hours)**, independently of when a delayed draw completes. Winner rows are stored in the private schema with no browser table grants and filtered in the details RPC before reveal, including the original names and correction history. Payout recording is blocked until release. The frontend shows the reveal deadline/countdown and refreshes at the release time. If final verification is still unavailable at that deadline, results remain pending until a valid draw exists.

Only the database owner may inspect sealed winner rows and correct a winner’s display name through the SQL backend. They cannot change the winning Torn ID, account, rank, prize or original randomly selected name. Every correction requires a reason and records an immutable audit entry. The corrected name, original name and reason become visible with the revealed result. Hosting a campaign alone does not grant administrator access. Example in the privileged Supabase SQL editor (replace the campaign UUID and text):

```sql
select public.admin_correct_lucky_draw_name(
 '00000000-0000-4000-8000-000000000001', 1,
 'CorrectedDisplayName', 'Updated to the player’s current Torn display name'
);
```

App accounts (including `profiles.role = 'admin'`), anonymous clients and the backend `service_role` cannot execute the correction RPC or directly read/update the private winner/audit tables. Only a database-owner SQL session may use the audited correction path. Direct winner updates are guarded too. This is a name correction, not a way to replace the winning player.

Deploy `20261110102735_lucky_draw_automatic_sealed_results.sql` plus both `sync-lucky-draw` and `process-lucky-draws` Edge Functions. Both validate their own authentication and use `verify_jwt=false` for the existing publishable-key setup. The migration requires empty campaign/result tables and aborts instead of changing existing published results. The cron command reads the job token inside Vault; it is never written into source or returned to clients. No new plaintext credential is required.

### Private result storage, configurable reveal delay and release animation

Creators choose **Winner reveal delay after entry closes (hours)**: a whole number from **24 hours to 168 hours (7 days)**, default 24. The database validates both the permitted range and `reveal_at = closes_at + configured delay`. The published delay is immutable to ordinary clients. Client-supplied clocks, reveal timestamps, role flags and frontend edits cannot release names earlier.

`private.lucky_draw_winners` is outside the public Data API schema. `anon` and `authenticated` have no privileges on that table, including after release; the ordinary read path is the authenticated, server-time-gated campaign details RPC. The original name, selected Torn ID, corrected name and correction audit remain absent from sealed API responses. Service-only finalization/worker endpoints stay unavailable to browser roles, payment/receipt endpoints cannot be used as early-result oracles, functions use explicit schemas and typed parameters rather than dynamic user SQL, and name corrections require a database-owner SQL session. Narrow worker RPCs continue automatic selection and timed release without direct service-role table grants. Privileged database administrators retain administrative access by design; this is not a claim of absolute protection if those credentials or the database itself are compromised.

After the server returns `result_state = revealed`, a 3.2-second trophy, expanding gold halo and progress animation unveils the result cards with confetti. It never requests, chooses or preloads unreleased winner identities. Reduced-motion preferences skip the animation; a session flag avoids replaying it on every result refresh and stores no winner data. Animation presentation is separate from backend authorization.

Apply `20261110104618_lucky_draw_private_results_and_reveal_delay.sql` after the automatic sealed-results migration. Its empty-data guard aborts instead of moving active published campaign data without review. The migration moves storage without deleting result rows and rewires the existing typed backend functions to the private table. Existing Edge Functions and the scheduled worker use the same service-only RPCs and need no code deployment for this schema change. Security regression checks include private-schema denial, missing public result relation, forged reveal inputs, typed injection-shaped inputs, payout-oracle denial, administrator isolation, immutable result identities and both delay bounds.

Apply `20261110110259_lucky_draw_owner_only_corrections.sql` to revoke app-admin and service-role correction permissions. The authorization guard uses the actual SQL role/session and database ownership, never JWT or profile claims. The owner may inspect results in the SQL editor with `select * from private.lucky_draw_winners where campaign_id = '<campaign UUID>'::uuid;` and use the audited correction function above. Public results still appear only after the published reveal deadline. Winning Torn IDs remain immutable.

### Saved foreign shop purchase prices

`src/data/foreign-shop-prices.json` permanently stores screenshot purchase-price references shared on 2026-11-10 and 2026-11-11: Mexico has 34 items (10 General Store, 19 Arms Dealer, 5 Black Market); Canada has 21 items (8 General Store, 4 Arms Dealer, 9 Black Market); Switzerland has 14 items (5 General Store, 4 Arms Dealer, 5 Black Market); South Africa has 22 items (4 General Store, 10 Arms Dealer, 8 Black Market); Argentina has 15 items (5 General Store, 5 Arms Dealer, 5 Black Market). Each country retains its own price for shared items such as Opium. Out-of-stock items retain their displayed purchase prices without implying availability. Item IDs were matched against the saved official Torn catalogue. No screenshot stock counts are stored. Black Market prices are recorded observations, not guaranteed fixed prices. The Travel calculator exposes the saved list and uses it when fetched country/shop prices are absent; valid API prices take precedence. Market sale prices remain separate and must be fetched before estimating profit.
