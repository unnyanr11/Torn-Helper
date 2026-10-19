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

Original advisor notices include [mutable search paths](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [public SECURITY DEFINER execution](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), and [pg_net in public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public). The repair pins search paths and removes direct execution of trigger functions. Relocating pg_net is not included because it requires a separate extension compatibility review.

## Included local implementation

- Sign-in, account creation, key replacement/removal, identity-only mode without key retention, pause tracking, personal data export and guarded account deletion.
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

## Validation and limits

- TypeScript/Vite production build passes.
- All 43 automated tests pass: credential encryption/tampering, mocked Torn errors and response normalization, payout accounting, CSV/XLSX output, report expiry/redaction, actual PostgreSQL migration and core RLS checks, reservations, delayed/out-of-order evidence, duplicate payments, fraudulent funding, account-deletion liability guard and revive claims.
- All current static table/column references pass against the schema produced by the proposed migration. This catches known-name drift, not every possible dynamic query or complete feature acceptance.
- Deno type checks pass for all 15 Edge Function entrypoints.
- Final npm audit reports zero known advisories (down from 10: three critical, two high, five moderate). Vite 8.3.4, Vitest 5.0.5, React plugin 6.1.2 and Supabase CLI 2.121.0 are pinned; the ExcelJS UUID dependency is overridden to 11.1.1 and XLSX round-trip tests pass.
- PostgreSQL tests run through PGlite using captured production table definitions and policies. Supabase Auth/Vault/cron scaffolding is mocked; real production network scheduling and secret configuration are not validated by these tests.
- Simultaneous claim promises are tested transactionally, but PGlite serializes its single connection. Multi-session lock contention, load and production smoke tests remain required.
- Real Torn identities/keys and paid provider calls were not exercised. No production test users or financial records were created.
- Browser visual acceptance is not complete: the browser binary download failed in this environment. Mobile behavior, real sessions, uploads, Realtime delivery and push require staging acceptance.

## Remaining required scope

The matrix keeps every inspected competitor feature partial or blocked until its complete workflow is accepted. In particular:

1. Clean baseline migrations: historical numbered files conflict with the deployed schema and each other. Do not apply the whole history to this existing project.
2. Authoritative faction-role synchronization, shared war workspaces, cross-member dibs/officer overrides, complete roster comparisons/distributions, alliance/family sharing and revocation.
3. Full payout revenue/cost accounting, published versioned policies, imported verified contributions, category classification, member statements and adjustment workflows. The repaired private calculation is not the entire faction accounting product.
4. Saved comparison sets, leaderboard populations/ranges/presets and complete table-layout presets.
5. Snapshot collection and all requested historical windows, gap accounting, full training/war/flight/activity collection, budgeted scheduling for watched factions and global API budgets. No history is fabricated before collection starts.
6. Dedicated bounty contract verification/settlement, operational mortgage applications/agreements/installment/arrears workflows, and the expanded multi-asset ROI/cash-flow scenarios. Existing small calculators do not satisfy these workflows.
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
