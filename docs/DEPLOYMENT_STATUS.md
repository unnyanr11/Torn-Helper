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


### Spatial interface redesign

Replaced the shared visual system and application shell across every page with layered dark/light surfaces, translucent navigation, violet/cyan ambient lighting, frosted borders, a floating quick-navigation dock and a refreshed app mark. All existing destinations remain in an authenticated, role-filtered sidebar, now grouped into Workspace, Intelligence, Operations, Faction, Economy, Explore and Account. Navigation search, Ctrl/Cmd+K focus, Escape-to-close mobile navigation, skip-to-content and a compact mobile drawer are included. Existing page forms, cards, tables, privacy disclosures and data panels inherit the new design system; no game observations or financial values were added.

Motion includes route entrances, staggered navigation, cards revealed as they enter the viewport, pointer lighting, subtle card tilt, button sheen/press effects, dock lift and ambient orbs. Pointer work is event-driven with at most one scheduled animation frame, not a permanent JavaScript loop. Focused input cards do not tilt. Large cards reveal on first intersection; unsupported observer environments keep content visible. The system reduced-motion preference and the explicit Reduce animations button disable motion; theme/motion preferences persist locally. Fonts have system fallbacks. Phone privacy disclosures remain scrollable with readable column widths and keyboard focus. The dock appears for authenticated workspaces, not on the sign-in form.

Updated theme colors, favicon/PWA icon and shell-cache version. Supabase authentication, page access checks, privacy controls and API integrations are preserved. Validation: all 125 tests pass, including grouped-navigation coverage of authorized destinations, exclusion of privileged routes and shared-report labels. TypeScript/Vite production build passes. Browser QA at 1440×1000 and 390×844 covered dark/light sign-in, reduced motion, mobile menu/Escape, signed-in API catalog (234 cards), navigation filtering and the data browser. No document-level horizontal overflow or JavaScript page errors were observed. Signed-in visual QA used a local mocked session with every backend request intercepted; no production accounts or fake game records were created.

## Complete personal-data dashboard (2026-10-19)

Overview now hosts My Torn: 64 owner datasets / 66 parameterized section requests,
including Friends, Enemies and Targets separately. Collection prioritizes profile,
bars, battle stats, all personal stats (`cat=all`), money, net worth, work stats and
skills. Every successful section appears immediately in rich metrics, resource bars,
expandable groups and pageable record lists. The general data browser uses the same
renderer, preserving its optional raw developer view and JSON export.

Explicit collection uses either a request-only key scoped to the collection or the
existing encrypted key. Existing owner-only cache observations can be restored for
24 hours; there is no private-data or API-key browser-storage addition. Responses
remain subject to existing cache limits. Collection is sequential, spaced 3.4 seconds
apart to accommodate three upstream requests per request-only fetch, with one
65-second retry on quota errors. Users can stop it; leaving the page cancels further
requests. Per-section errors preserve prior observations and identity/configuration
failures stop collection. Numeric deltas compare actual observations in memory.

Long histories show a single API page, with explicit browser links to continue.
Detailed crime/trade lookups require IDs and are linked separately. Other-player
lookups, global search and API metadata are not mislabeled personal datasets.
The dashboard does not promise access to data Torn denies or historical records
not returned by the API.

Validation: 130 tests pass; TypeScript and production build pass. No legitimate
Torn key was available for positive live-key testing. Browser QA was unavailable
in this managed session; renderer checks use server-rendered API fixtures.

## Connected data groups (2026-10-22)

Overview connects ten selectable groups: Personal, Crimes, Inventory, Investments,
Faction, Company, Properties, Combat, Racing and Progress. Existing tracker pages
open the matching group. The collector deduplicates identical requests, discovers
crime statistics/actions, inventory item details/listings, owned-stock chart history,
property sale/rental listings, property details, race details, track/class records,
attack logs, chain reports, ranked war reports and organized crime details from
actual returned IDs. Required IDs and filters are preserved in individual-browser
links; API pagination can continue there. All requests still pass through the
existing authenticated, owner-verifying, allowlisted gateway.

Collection remains explicit and cancellable, with one quota retry, 3.4-second request
spacing and per-section permission errors. Automatic expansion is bounded at 120
additional calls, 20 per source (100 for crime catalogues); every remaining related
lookup remains individually accessible. A complete set can take 10–20 minutes.
Cache restoration is limited to 100 private requests/24 hours; it is not a full
historical archive.

Connected insights calculate estimates only from available inventory quantities and
catalogue market prices, and owned stock shares with observed stock prices. Missing
prices stay unknown; faction-owned inventory is excluded. Quotes have separate
observation dates and estimates do not imply realized proceeds. Education completion
is joined to the course catalogue. Combat counts explicitly describe the returned
outgoing sample. Returned stock price history is charted by its actual timestamps.

The deployed `torn-data` v3 records fresh, unfiltered current personal-stat observations
through the existing service-only snapshot RPC. Existing opt-in, pause and minimum
interval controls remain in force. Current battle, job, crime skill and net-worth
fields present in `cat=all` can be explored in History Explorer. No schedule, backfill
or inventory-value history is implied. Cached or timestamp-filtered observations
are not recorded as fresh history. A history-write failure preserves the fetched
response and reports a warning.

Validation: 138 tests pass, production TypeScript/Vite build passes, and Deno checks
the deployed function. Live gateway rejects unauthenticated calls with 401. Live
history table RLS is enabled; authenticated clients can read owner rows but cannot
insert snapshots or execute the recording RPC; service_role can record. Security
advisor findings remain the pre-existing private workflow audit INFO and disabled
password-breach protection WARN. No legitimate Torn key was available for positive
private-data acceptance checks; browser QA was unavailable in this managed session.

## Simple standalone UX (2026-10-22)

Replaced the spatial shell with a compact, task-first layout: seven primary tools,
a More tools dropdown, system fonts, light/dark themes, plain surfaces and a mobile
menu. The floating dock, ambient scene and pointer-motion hook are no longer used.
Overview defaults to the Personal group, uses one group selector and refresh action,
and puts history settings and collection limits in expandable sections. Result
sections can be selected from a dropdown instead of a typed search.

Known players, crimes, racing tracks/cars/positions, items, properties and custom
stat units now use dropdowns. Comparison has individual player selectors. API forms
use documented enum/boolean dropdowns, multi-selects for array enums, bounded page
size selectors, UTC date pickers and cached catalogue IDs. Unknown IDs and custom
names retain explicit manual-entry fallbacks; credentials, notes and custom amounts
remain inputs. Lists are populated from owner-protected observations, with empty
states rather than invented game records. Data group refresh invalidates the shared
choice catalogue.

External profile/attack navigation now uses internal player lookup. Competitor
comparison, Discord/TornStats and optional external AI integration pages are blocked
from navigation and direct routing. External signup/pricing links and the external
font import were removed. The official Torn API and the existing Supabase backend
remain the app's required data infrastructure. No external website UI or content was
embedded, imported or connected.

Validation: 143 tests and production build pass. Render tests cover dropdowns,
custom-value preservation, current cache choices, enum arrays, date/page controls,
access restrictions and navigation. Static UI audit finds no external URLs in
components, pages, the stylesheet or index. Browser QA remains unavailable in this
managed session; no positive private-data key test was performed.

## Category navigation and automatic travel comparison (2026-10-22)

Restored all authorized tools under the prior Workspace, Intelligence, Operations,
Faction, Economy, Explore and Account groups. The simple visual treatment remains;
the More tools selector is removed. Optional external integrations remain blocked.

Travel and Travel Optimizer now share one calculator: location → item category →
item. Categories and items come from actual Torn item catalogue entries with a
returned buy price for the selected country. Loading items also retrieves the
owner's travel method/timestamps. Selecting an item automatically refreshes its
shop catalogue entry and scans item-market listings through the existing validated
gateway. Request-only keys stay in page memory with explicit disclosure; saved
keys remain supported. Requests are debounced, serialized at 3.4 seconds, cancellable
and protected against late updates when country/item changes.

Market scans examine five pages per action, then provide a continuation button.
A complete scan is labeled separately from a partial lowest-observed quote. Empty
or invalid listings stay unknown, and mixed global-cache timestamps block the
estimate until refresh. No foreign stock quantities or guaranteed sale proceeds
are inferred. No third-party travel feed or external navigation was introduced.

Profit includes quantity, selling fee (default regular market 5%), direct trip
travel budget, both flight legs and optional shopping/waiting time. Negative results
are shown. A matching personal outbound duration is preferred; the return is
estimated equal. Otherwise published official route times are labeled estimates,
with book/time overrides. Route metadata was checked against the official Torn
Travel wiki on 2026-10-22; it is configuration, not seeded observations. The travel
API does not return an actual charged fare: airstrip/private cash fares are
estimated zero excluding overhead, standard paid legs use reference fares, and
business tickets use fetched ticket listings when available or an explicit budget.
Users can override costs/time. Capacity is user-selected, not claimed API capacity.

Saved estimates preserve current calculated profit/per-hour values. The legacy
integer `flight_minutes` field rounds total duration upward to a whole minute;
profit/hour is calculated using the exact displayed duration. Historical manual
observations remain accessible and unmodified.

Validation: 152 tests and production build pass. Tests cover country/category
filtering, missing prices, full/partial scans, fee-adjusted losses, round-trip time,
method matching, queue spacing/cancellation, stale responses and cache changes.
Browser and legitimate-key acceptance testing remain unavailable in this session.


## Ready-made levelling lists — 2026-10-22

Targets now opens with 32 real community-reported targets from the first levelling
table in Baldr’s public official Torn forum guide (thread 16034448). Three built-in
subsets and status/sort dropdowns work immediately without creating database lists.
Existing custom lists remain available below. No external website integration,
outbound links, automatic database seeding or schema changes were added.

Names, levels and battle totals are explicitly reported values until applicable
profile fields are refreshed. Battle totals remain unverified community claims;
public profiles cannot verify private battle stats. The retrieval date is not a spy
date. Live profile checks use the existing Torn gateway, encrypted saved keys or a
request-only key with explicit optional page-memory retention, cancellation and
3.4-second spacing. Available requires a fresh Okay status and observed inactivity;
statuses expire after one minute. Individual rechecks are available.

Validation: 157 tests and production build pass, including immediate populated
rendering, filtering, freshness, inactivity and response-identity validation.
Browser and legitimate-key acceptance testing remain unavailable in this session.


### Official Torn attack action — 2026-10-22

At the user's request, each built-in levelling target now has an Attack action
opening that player's official Torn attack page in a new tab. The link contains
only the target ID, uses noopener/noreferrer, and is available without an API key.
No attack is initiated by this app. Other target-list websites remain unlinked.
Validation: existing render coverage checks all 32 attack links; 157 tests and
production build pass.
