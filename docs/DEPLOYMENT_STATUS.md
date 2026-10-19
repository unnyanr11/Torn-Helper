# Approved deployment status

Project: `caxhhhtrlqfuatraamto` / Torn-Helper. Date: 19 October 2026.

The user explicitly approved the previously reviewed coordinated migration and deployment. The migration `repair_runtime_security_and_marketplaces` applied successfully. All 15 matching Edge Functions were deployed successfully.

## Live checks completed

- Production transaction smoke test created temporary identities, acquired a loss claim, verified an attack and checked the resulting ledger. The entire transaction was rolled back; no test identities, claims or settlement records remained.
- Browser roles cannot read credential ciphertext, update profile roles, insert authoritative identity/membership records, or insert verified attack evidence. Safe profile fields remain editable.
- All six coordination tables are published to Realtime behind RLS.
- `verify-loss-payment` runs every two minutes; `evaluate-alerts` runs every five minutes. Both use the scoped Vault token rather than a service-role database setting.
- Direct scheduled HTTP smoke calls returned 200: loss verification reported zero pending claims; alert evaluation reported zero rules. Neither timed out.
- Security advisors no longer report public privileged-function execution or mutable function search paths. The existing pg_net extension-in-public warning remains; the private, deliberately inaccessible audit table also has an informational no-policy notice.
- The frontend production build, all 43 automated tests, the candidate schema audit and 15 Deno entrypoint type checks passed. The dependency audit reports zero known advisories.

- All 13 protected HTTP endpoints reject unauthenticated requests with 401. Public API path normalization now supports both external and gateway-relative URLs; regression tests cover both forms.

## Limits

The complete feature specification remains unfinished; see IMPLEMENTATION_AUDIT.md and the coverage matrix. Real Torn-key/provider-key operations, signed-in browser flows, Realtime delivery, uploads and multi-session stress tests still require acceptance checks with legitimate accounts and data.

The user explicitly approved publishing the matching source directly to the public `unnyanr11/Torn-Helper` repository on `main`. This supersedes the earlier publication approval block. The source in this repository matches the approved backend repair, including the public API routing correction. No independent frontend hosting target was supplied or configured, so source publication is not a claim that a hosted frontend was redeployed.

Key encryption uses the project's existing server-only `TORN_KEY_ENCRYPTION_KEY` configuration. Its value was neither read nor exposed; linking a legitimate key is required to validate that configuration end to end.


## Follow-up: workspace persistence, mortgages and opt-in history

Applied `saved_workspaces_and_mortgage_ledger` and `opt_in_personal_history` successfully on 19 October 2026. These add seven RLS-protected tables and private mortgage RPC implementations, owner-only preset persistence, an explicit history opt-in and service-only observation recording.

Deployed `account-data` version 2 and `refresh-live-data` version 3. Both continue to authenticate in the function body and reject unauthenticated HTTP calls with 401.

Live rollback smoke validation passed application creation/activation, schedule generation, partial payment allocation, correction with retained audit, preset persistence and an opted-in official numeric snapshot. No fixture records were retained. Catalog checks confirm all seven new tables have RLS and anonymous mortgage execution, browser official-history insertion and direct payment mutation are disallowed.

Local validation: 66 tests, production build, candidate schema-reference audit and all 15 Deno entrypoint checks. Security advisors return the previously documented pg_net warning and inaccessible audit-table informational notice; no additional warning was returned. The advisor results carry their own collection timestamp, so live grants/RLS were checked directly as well.

This follow-up source is published to main under the user's standing approval. A separate frontend hosting deployment is still not configured. Actual key-enabled collection, signed-in browser flows and concurrent multi-session contention remain unverified. Broader unfinished features remain listed in IMPLEMENTATION_AUDIT.md.


## pg_net warning resolved

On 19 October 2026, migration `relocate_pg_net_extension` recreated pg_net 0.20.4 in the `extensions` registration schema using Supabase's documented procedure. Its callable API remains in `net`.

The migration takes exclusive queue/response locks, refuses a nonempty queue or active worker/job, preserves stored response rows and the request sequence, keeps the installed version and uses `DROP EXTENSION` without CASCADE so unexpected dependencies abort atomically. Both net-calling cron jobs were briefly paused through `cron.alter_job` and then restored to their original active state and schedules.

Live checks confirmed schema `extensions`, version 0.20.4, preserved response history and request numbering, and both schedules active. Authenticated pg_net smoke requests to `verify-loss-payment` and `evaluate-alerts` returned HTTP 200 without timeouts. The Security Advisor no longer returns `extension_in_public`; its only remaining notice is informational RLS-without-policy on the intentionally inaccessible `private.workflow_audit` table.

Reference: https://supabase.com/docs/guides/database/extensions/pg_net#troubleshooting


## Production data and launch safeguards

Removed the signed-out demo dashboard, seed-data module, prefilled payout contributions and sample investment/mortgage amounts. Empty accounts show sign-in or no-data states. Test fixtures remain isolated in the automated test suite and are never used as runtime fallbacks. Source inspection found no production data seeder. A live count-only audit found zero profiles, wars, payout runs, loss contracts, saved presets, mortgage agreements, integration credentials, webhooks or temporary fixture users; no real user data was deleted.

Applied migration `production_integration_safeguards`. Browser roles cannot read integration token/webhook secret columns, create/update adapter connections, or enable email/push preferences without a delivery implementation. Owner-scoped connection metadata and removal are retained. The UI no longer offers plaintext TornStats token entry, direct browser webhook sends or nonfunctional notification opt-ins. Manual spy imports remain available.

Additional source changes: mandatory authenticated workspace rendering and role-checked deep links; session initialization state and account isolation; password reset/recovery; runtime error recovery; production build configuration checks including rejection of server-side keys; explicit Vercel configuration and security headers; application branding assets instead of missing template icons; service-worker cache version refresh.

Validation: 73 tests pass, including server-render checks of empty financial forms, configuration/access checks, and actual PostgreSQL integration-secret privilege tests. Schema-reference audit and TypeScript/Vite build pass. The positive build used a nonsecret test publishable-key-shaped value solely to validate bundling; this does not verify the user's hosted project key. A separate negative build confirmed that server-side credentials are rejected. Live database grants match the intended safeguards. The Security Advisor returns only the informational no-policy notice for the deliberately inaccessible private audit table.

Source publication is not evidence of a completed Vercel rollout. Configure the real public project environment and Auth redirect origin, redeploy the frontend, and complete signed-in browser acceptance. External delivery integrations and the other incomplete feature families remain unavailable or partial as documented.


## Torn API key authentication

Replaced the end-user email/password flow with **Continue with Torn**. Migration `torn_key_authentication` and the new `sign-in-torn` Edge Function provide server-verified identity ownership, transactional unique account mapping and optional encrypted credential retention. `link-torn-key` additionally refuses identity changes on an existing account.

The server checks Torn `/user/basic` and `/key/info`, reuses existing linked users or provisions a random internal Supabase Auth alias, then generates a one-time token for the browser to exchange for a normal RLS-scoped app session. This administrative link generation does not send email. No Torn key or administrative credential is included in the response. Internal aliases are random rather than predictable Torn-ID-derived addresses to avoid pre-registration account squatting.

Requests are size-bounded and limited globally/per client/per key using keyed HMAC fingerprints retained for at most approximately one hour of activity. The client-IP quota supplements the independent global/key quotas. Retention defaults off and requires an explicit checkbox choice; raw keys are not written to browser storage. A declined retention choice removes any previously stored Torn credential. Public-only keys cannot sign in.

Local validation: 87 tests, build/schema audit and Deno checks, including upstream identity mismatch/error rejection, account reuse, optional encryption, cleanup of losing account proposals, session-ID mismatch, request bounds, server-only RPC access and transactional mapping/rate-budget behavior. Requests to the deployed public login endpoint with malformed/oversize bodies are rejected before upstream/auth operations. A legitimate Torn key and full hosted user sign-in/session persistence still require live user acceptance; the automated Torn responses are mocked. No production sign-in test key or user account was fabricated.


### Torn login retention configuration

Live diagnostics confirmed that `TORN_KEY_ENCRYPTION_KEY` is absent from the deployed Edge Function environment. Sign-in with retention selected therefore failed before account creation. The function now gives an explicit configuration error and allows the user to retry with retention unchecked; it never silently changes that choice. Controlled failure stages and machine error codes are logged without API keys, tokens or upstream response bodies. Identity-only login does not require this secret.

To enable retention, generate a new 32-byte base64 secret locally with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` and save it as `TORN_KEY_ENCRYPTION_KEY` in Supabase Dashboard → Edge Functions → Secrets. This is a server-only secret, not a Vercel `VITE_` environment variable. Preserve it after configuration so existing encrypted keys remain readable. The connected Supabase tools cannot set project secrets, so this configuration remains a dashboard step. No real-key successful sign-in has been verified.


### Overview refresh and function error repair

Live diagnostics confirmed the account is linked and signed in, but has no retained Torn credential. Earlier Overview calls returned HTTP 400 and the client hid the response JSON behind a generic non-2xx message. Identity-only sign-in remains valid; it does not imply permission to retain a raw API key.

Overview now accepts an explicitly submitted request-only key, verifies its Torn owner against the current linked identity, and discards the raw key after the request. It uses the same private observation cache and opt-in history rules; observations persist, keys do not. Stored-key collection remains available after configuring server encryption. Missing credentials, missing/corrupt encryption, paused tracking and upstream errors have actionable responses. Credential/database errors fail closed rather than masquerading as missing data.

The five overview selections are fetched separately. Permitted sections are preserved when another selection is denied/unavailable, with explicit per-section warnings. No missing game values are synthesized. Entirely failed refreshes are not cached. Existing 60-second caching remains in effect; frontend automatic retries/focus refreshes are disabled on Overview to avoid repetitive requests without a stored key. Settings displays actual retained-key status, while a shared response parser reveals function errors across Overview, history collection, key settings, player lookups, AI requests, shared reports and marketplace actions. Live Feeds uses the Supabase SDK and clears its busy state after network failures.

Validation: 99 tests pass, production TypeScript/Vite build passes, and the schema-reference audit passes. New tests cover ownership mismatch, request-only refresh without encryption configuration, revoked identities, credential query errors, encryption failures, partial permissions, total upstream failure and non-2xx/gateway response parsing. Live grants confirm clients can read credential status but cannot read ciphertext or invoke identity provisioning. No successful real-key Overview request has been performed by the agent. Security Advisor still reports the deliberately inaccessible private audit table (INFO) and disabled leaked-password protection (WARN); the product uses Torn-key authentication, and the connected tools cannot update Auth service configuration.


### Complete documented Torn data browser

Connected all 234 GET endpoints in official Torn OpenAPI 6.13.8, across nine groups: user (85), faction (54), Torn reference (46), company (13), market (12), racing (9), forum (8), property (4), key (3). The registry was regenerated from the current official spec with resolved parameter schemas. Live Feeds is now the Torn Data Browser; Overview and relevant tracker pages link to it, and every API Usage registry card opens its data section.

The browser exposes required path IDs, optional filters, date ranges and pagination parameters; only the selected request runs. Validated next-page links can be followed manually. Each response is displayed in full as an observation and can be downloaded as JSON. This makes the data accessible through the browser; it does not automatically replace manually entered ledger records or create historical data that Torn has not returned. Access still depends on the key's selections and the player's faction/company role. Full Access cannot reveal another player's private data or otherwise override Torn permissions.

The new `torn-data` Edge Function validates an endpoint ID against the generated GET-only allowlist, accepts only documented parameters, checks tracking pause and linked identity, verifies request-only key ownership, and uses header authentication to the fixed official Torn host. Unknown endpoints, extra credential parameters, invalid IDs/enums/limits, path traversal and arbitrary pagination hosts are rejected. Request-only keys are discarded after use unless the user explicitly chooses page-memory reuse; leaving/reloading clears that memory. Keys are never put in persistent browser storage. Upstream responses and pagination links are scrubbed of echoed keys before returning/caching.

Applied migration `api_data_browser`. New private `torn_data_cache` observations have owner-only SELECT/DELETE policies and service-only writes. Cache freshness is 60 seconds, with a maximum of 100 observations per account; records older than 24 hours are removed on the next successful write. A server-only atomic budget caps this browser at 60 counted upstream calls per account/minute and 600 per project/minute; request-only fetches cost three units to include ownership checks. These app budgets do not guarantee that other tools using the same Torn account have left upstream quota available. Request bodies are capped at 8 KiB and each fetched response at 2 MiB. Account exports include these observations, and account deletion cascades to them.

Validation: 115 tests pass, including compilation of all 234 endpoints with required parameters, schema validation, credential redaction, host/path restrictions, pagination, response limits, cross-account cache isolation, denied browser writes/RPC execution, bounded cache size and request budgets. TypeScript/Vite production build, gateway/account Edge Function type checks and schema-reference audit pass. The live gateway rejects unauthenticated requests with 401; live grants confirm owner-only reads and no browser write or privileged RPC access. All 17 Edge Functions pass Deno type checks. No new Security Advisor findings were introduced (the existing password-protection warning and inaccessible audit-table INFO remain). Positive calls using a real Torn API key still require user acceptance; the agent has not requested or used the user's key.


### Comparison preset fetch and dated trends

Diagnosed an existing comparison preset with no fetched sections or personal history records. Previously loading a preset only restored IDs/window, and Compare Players queried local tables, so it could not display fresh player data. Comparison preset loading now awaits a fetch through the deployed `torn-data` gateway, with request-only or encrypted stored-key access. Keys are cleared from the form on submission and are never saved in presets.

For each of 2–5 players, the comparison loads the official profile and requests seven public historic stat fields at the requested past and current boundaries: attackswon, defendswon, criminaloffenses, traveltimes, raceswon, revives and networth. Each request validates through the existing endpoint/schema allowlist and participates in its rate budget. Batches run one player at a time with three section calls per player; key ownership checks remain in the gateway. The UI displays names, levels, statuses, latest returned numeric values, observation times, changes and trend points. Intermediate history is not invented. Duplicate timestamps collapse; missing/denied history remains unknown, and an old boundary value is never mislabeled as current when the current request fails. Quota/credential failures stop further player requests.

Legacy comparison presets still load (missing metric defaults to attackswon). Newly saved presets include the selected metric. Saved-presets loading now awaits asynchronous callbacks and reports failures rather than claiming success immediately. Loading/empty states explain saved configurations separately from data. Existing local target observations, imported spy evidence, battle-stat distributions, total differences and sampled activity remain available, including a saved-observations-only mode. Profile/activity cannot infer private battle stats.

Validation: 122 tests pass, including gateway-schema checks on actual comparison request construction, selected windows and player IDs, historical/current failure separation, missing dates, quota stopping, duplicate/malformed historical values and trend rendering. Production TypeScript/Vite build and schema-reference audit pass. No database migration or backend redeployment is required for this frontend integration. Positive real-key comparison fetching still requires user acceptance.
