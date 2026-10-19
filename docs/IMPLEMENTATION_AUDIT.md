# Implementation audit and proposed repair

Audit date: 19 October 2026. Repository: `unnyanr11/Torn-Helper`, baseline `cfa9ef3`. Supabase project: `caxhhhtrlqfuatraamto` (`Torn-Helper`).

**The complete supplied feature set is not delivered.** This is a coordinated repair batch, tested locally and approved for deployment on 19 October 2026. See DEPLOYMENT_STATUS.md for live verification and source publication. The 84-row competitor matrix and supplied requirements preserve the remaining scope.

## What was inspected

- Every page module and function source was included in the static reference audit; see [PAGE_INVENTORY.md](PAGE_INVENTORY.md).
- Captured columns, constraints and RLS policies for all 90 public tables. Inspected deployed function inventory, selected deployed implementation, cron configuration, Realtime publication and security advisors.
- Reviewed Torn API guidance and OpenAPI version 6.13.8, FFScouter public guides/premium/API documentation, and Torn Intel free/Pro/pricing documentation. Authenticated competitor workflows were not inspected.
- The attachment's implemented checklist was treated as a claim requiring verification, not evidence that a workflow works.

## Confirmed production findings

| Finding | Evidence | Proposed repair |
|---|---|---|
| Frontend does not build | TypeScript failures including unreachable Stocks route, absent Vite declarations, unsupported `supabase.raw`, remote spreadsheet import and broken test typing | Build repairs, real XLSX dependency, test replacement and navigation wiring |
| No app sign-in workflow | No reachable account UI; unconditional demo header | Account/settings screen, authentication-aware overview and status |
| Schema drift | Code references missing `targets`, `target_estimates`, `target_observations`, `torn_keys`, mismatched payout and loss columns | Align queries with deployed tables; add transactional RPCs and compatibility columns where needed |
| Role escalation possible | Owner-update policy plus table update privilege on `profiles.role` | Revoke general profile mutations; grant updates only on safe profile columns |
| Identity/membership self-authorization | Users can write their own identity and membership rows | Server-only identity and authoritative membership writes |
| Ciphertext accessible to browsers | Credential owner policy permits selecting all columns | Grant only key-status metadata; retrieve ciphertext exclusively server-side |
| Unrestricted attack/revive evidence | `USING(true) WITH CHECK(true)` policies | Participant read access; server-only loss evidence writes |
| Seller can change settlement ledger | Seller owner-ALL policy | Audited, state-checked settlement RPC; seller confirms receipt only |
| Financial UI/worker disagreement | Two incompatible sets of loss tables/field names | Use the deployed `loss_attack_evidence` and `loss_settlement_entries` flow consistently |
| Claims can oversell | Separate claim insert and client-side capacity check | Seller advisory lock, contract row lock, quota checks and one-active-claim index |
| Delayed records can be lost | Active-only scan and no event-time reconciliation | Ten-minute grace, held capacity, globally unique attack IDs, chronological evidence replay |
| Cron jobs cannot authenticate correctly | Missing `app.settings.service_role_key`; user-only verifier scheduled as a service task | Vault-scoped scheduler token validated server-side, user and job execution paths |
| Realtime does not publish tables | Empty `supabase_realtime` publication | Publish six RLS-protected coordination tables |
| Funding verifier assumes unavailable data | Nonexistent credential role field and unverified transfer shape; deployed contracts permit only direct payment | Disable prepaid verification explicitly; preserve direct-payment workflow |
| False battle-stat certainty | Level/activity-derived numbers presented as estimates with confidence | Authorized evidence only; unavailable totals stay unknown |
| False reports | Report creation saves fabricated cash/networth/level values | Authorized JSON input, secret-field checks and explicit public-share confirmation |
| Private data cached by service worker | General GET caching includes cross-origin requests | Same-origin shell/assets only; no API/Auth/private cache |
| Companion stores raw Torn key | `GM_setValue` key persistence and HTML insertion | Credential-free manual links, old-key removal and safe DOM construction |

Original advisor notices include [mutable search paths](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [public SECURITY DEFINER execution](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), and [pg_net in public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public). The repair pins search paths and removes direct execution of trigger functions. Relocation was deferred in the original repair. A subsequent compatibility review and the `relocate_pg_net_extension` migration resolved the pg_net warning while preserving queued-response history and request numbering; see DEPLOYMENT_STATUS.md.

## Included local implementation

- Sign-in, account creation, password recovery, key replacement/removal, identity-only mode without key retention, pause tracking, personal data export and guarded account deletion. Demo dashboard values and prefilled financial examples were subsequently removed.
- Server-side identity derivation from Torn `/user/basic` and `/key/info`. One encrypted credential format for Torn/OpenAI/Gemini. Provider-specific AI consent, own-key lookup, safe errors and a rules-based fallback.
- Official-data overview, searchable player profile, comparisons using actual observations/evidence, corrected growth and leaderboard queries, correct public API base URL.
- Loss contract creation in integer Torn dollars, transactional reservations, one active claim, event-time evidence validation, five-minute timing rules, fifteen-minute claims, ten-minute reconciliation grace, late-record replay, quotas and preserved partial earnings.
- Direct-payment buyer approval, manually recorded payment reference, seller receipt confirmation, duplicate-reference constraints, operator dispute resolution and an append-only private workflow audit.
- Server-verified revive claimant identity and atomic slot allocation; completion is explicitly seller-reported, not API-verified. Owner queue claims use server time.
- Corrected payout modes, pre-budgeted additions, floors/caps, deterministic remainder allocation, no negative or excess payments, transactional preview persistence and audited state transitions on a specific owned war.
- Alert evaluation using actual rules, fresh collected observations, quiet hours and deduplicated notifications. It does not claim continuous history or send Discord/email/push messages.
- Genuine CSV/XLSX exports with formula-injection protection. Immutable snapshot rows, revocable/expiring link lookup and recursive secret-field redaction.
- Generated registry for 234 documented v2 GET endpoints across nine groups; generated catalog of 224 distinct numeric personal-stat fields with official source paths. Documented fields do not imply available private values or collected history.
- Lazy page loading, authentication cache isolation, restricted offline caching and mobile overflow fixes.
- Deployment script covers every function and refuses to proceed until the schema repair is acknowledged. It does not perform unauthenticated financial verification probes.

## Follow-up implementation: saved workspaces, finance, and history

The follow-up adds the following working source and deployed database workflows. It does not claim complete competitor parity.

| Area | Implemented | Remaining limit |
|---|---|---|
| Comparisons | Named owner-only sets; stored ID selection and window; imported spy evidence, four-stat values when actually supplied, evidence timestamps, absolute/percentage differences | Full war metrics and shared/faction populations; queries currently cap each source at 1,000 rows and disclose this |
| Leaderboards | Metric/period selection, custom UTC dates, row limits, deterministic ties, named presets, explicit authorized population; racing separated by track; only approved/paid/reconciled payout runs | Additional verified faction/alliance/community populations and opt-in metrics |
| Target layouts | Named private layouts; show/hide, reorder, explicit widths, pinning, sort/search and exclusions | Layouts on other tables, safe formulas and authorized sharing |
| Mortgage records | Private applications; review/activation/decline/cancel; immutable terms and server-generated fixed monthly schedules; partial FIFO payments; arrears; unique references; settlement; corrections with retained allocations/audit; CSV schedule | No lender marketplace, counterparty acceptance, custody, late fees or verified Torn transfers. Future fixed-schedule installments can be paid early without repricing |
| ROI | Named multi-asset dated cash flows, fees/costs via negative flows, receipts/terminal valuations, net profit, simple ROI, dated annual return for conventional flows, NPV, cash recovery and CSV | Current game-specific valuations, benefit rules, automatic scenario construction and reinvestment/sensitivity modeling |
| Personal history | Explicit opt-in; immutable official numeric leaves from successful overview refreshes; 1/7/30/90/180/365-day/all-history windows; actual observation dates, observed changes, gap disclosure and CSV | Collection is on demand, not scheduled; no backfill, continuous coverage or automatic training/attack-log imports |
| Evidence imports | Bounded quoted CSV/TSV parser, all-or-nothing row validation, duplicate-ID checks, no coercion of missing/malformed stats to zero; manual source labeling in comparisons/intelligence | Original spy timestamps and third-party verification are not supplied by this import |
| Account privacy | Exports include presets, mortgage schedules/payments/allocations/audit and history; account workspace remounts on actual user-ID changes | Signed-in browser acceptance still outstanding |
| Bounty tracker | Correct filter refresh and error handling; strict whole-number inputs and explicit public-contract blocker | Hospitalization verification, transactional marketplace and settlement remain unfinished |

The migrations are `saved_workspaces_and_mortgage_ledger` and `opt_in_personal_history`. Mortgage mutations run through private authenticated functions with invoker API wrappers; browser roles have read-only ledger access. Official history insertion is service-only and rechecks opt-in/pause under a profile row lock.

## Validation and limits

- TypeScript/Vite production build passes with explicit client configuration. Missing configuration or a server/service-role key blocks production builds. The latest production cleanup has 73 passing tests; the earlier verification counts below describe their original batches.
- All 66 automated tests pass: credential encryption/tampering, mocked Torn errors and response normalization, payout accounting, CSV/XLSX output, report expiry/redaction, actual PostgreSQL migration and core RLS checks, reservations, delayed/out-of-order evidence, duplicate payments, fraudulent funding, account-deletion liability guard and revive claims.
- All current static table/column references pass against the schema produced by the proposed migration. This catches known-name drift, not every possible dynamic query or complete feature acceptance.
- Deno type checks pass for all 15 Edge Function entrypoints.
- Final npm audit reports zero known advisories (down from 10: three critical, two high, five moderate). Vite 8.3.4, Vitest 5.0.5, React plugin 6.1.2 and Supabase CLI 2.121.0 are pinned; the ExcelJS UUID dependency is overridden to 11.1.1 and XLSX round-trip tests pass.
- PostgreSQL tests run through PGlite using captured production table definitions and policies. Supabase Auth/Vault/cron scaffolding is mocked; real production network scheduling and secret configuration are not validated by these tests.
- Simultaneous claim promises are tested transactionally, but PGlite serializes its single connection. Multi-session lock contention, load and production smoke tests remain required.
- Real Torn identities/keys and paid provider calls were not exercised. Temporary production validation rows were created only inside rolled-back transactions; no fixture identities or financial records were retained.
- Browser visual acceptance is not complete: the browser binary download failed in this environment. Mobile behavior, real sessions, uploads, Realtime delivery and push require staging acceptance.

## Remaining required scope

The matrix keeps every inspected competitor feature partial or blocked until its complete workflow is accepted. In particular:

1. Clean baseline migrations: historical numbered files conflict with the deployed schema and each other. Do not apply the whole history to this existing project.
2. Authoritative faction-role synchronization, shared war workspaces, cross-member dibs/officer overrides, complete roster comparisons/distributions, alliance/family sharing and revocation.
3. Full payout revenue/cost accounting, published versioned policies, imported verified contributions, category classification, member statements and adjustment workflows. The repaired private calculation is not the entire faction accounting product.
4. Remaining comparison war-performance fields, additional authorized leaderboard populations/metrics, table presets beyond Targets, safe formulas and sharing. Private saved sets, selectable leaderboard ranges/presets and target layouts are now implemented.
5. Scheduled snapshot collection, full training/war/flight/activity imports, budgeted watched-faction scheduling and global API budgets. Opt-in on-demand personal snapshots, observed-window changes and gap disclosure are implemented; unavailable prior history remains unknown.
6. Dedicated bounty contract verification/settlement, a reviewed lender service with counterparty acceptance and funding, and game-specific ROI valuation/reinvestment/sensitivity tools. Private mortgage application/agreement/installment/payment/arrears bookkeeping and saved multi-asset cash-flow analysis are implemented.
7. Authorized list imports and licensed redistribution; legitimate third-party credentials/terms/caching/attribution for FFScouter and TornStats; permitted foreign-stock feeds. Proprietary coverage/prediction accuracy is not reproduced.
8. Operator custody, deposits, Xanax valuation, refunds, payout staffing and an operating policy before enabling prepaid loss contracts. Direct payment remains supported.
9. API-verified revive evidence, pending/rejected evidence review, expanded fraud handling, payout batching and overdue-settlement alert workflows.
10. Push/email/Discord infrastructure and verified account/channel routing; contextual assistant retrieval; community threading/mentions/moderation; upload abuse and storage-quota controls; extended companion overlays.
11. Verified mechanics and original guides for remaining seasonal/training tools, plus complete period-specific stat values and metric-unit definitions.
12. Full acceptance tests from the specification, including multi-session races, malformed uploads, authority changes, large ledgers, external outages, private sharing and browser accessibility.

These are unfinished requirements or external prerequisites, not delivered features.

## Deployment approval history

Automatic approval review rejected the attempted `repair_runtime_security_and_marketplaces` migration: it changes production RLS policies, grants, tables, privileged RPCs and cron schedules with a broad disruption/security impact. The tool required review and approval for this exact scope. The user subsequently approved the coordinated deployment. No workaround was used.

The concrete proposed deployment consists of the reviewed migration, coordinated Edge Functions and matching frontend. It changes key visibility and identity/role writes, replaces direct financial mutations with RPCs, publishes coordination tables, replaces scheduled authentication, and disables unverified prepaid funding. It must be tested in staging and rechecked with advisors before a production completion claim.


## Production cleanup limits

The runtime seed-data module, unauthenticated sample dashboard and sample financial inputs have been removed. Authentication and administrator checks apply to deep links as well as navigation. No full-database wipe was performed: production audit counts showed no fixture accounts or financial rows requiring deletion. Reference catalogs, glossary definitions and isolated automated test fixtures are not account seed data.

Unconfigured Discord, TornStats token collection and email/push opt-ins are blocked in both the relevant browser UI and database grants. Finishing those adapters requires secure backend implementations and actual configuration; suppressing demo values does not complete the wider feature specification. Real hosted acceptance, user-key/provider operations and other previously listed requirements remain outstanding.
