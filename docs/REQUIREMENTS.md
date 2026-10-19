Here's your complete updated prompt with all the changes we made in this chat, plus a clear implemented/leftover breakdown.

---

# Build prompt: free Torn companion platform

Act as a senior product designer, React engineer, Supabase architect, and security engineer. Build a production-oriented, mobile-first Torn City companion platform called **Torn Command Center**. It must consolidate personal planning, levelling targets, combat intelligence, faction management, war payouts, finance, travel, company management, and community tools.

Use React with TypeScript for the frontend and Supabase Auth, Postgres, Row Level Security, Edge Functions, scheduled database jobs, and Realtime for the backend. Use a suitable React chart library and query cache. Make the interface responsive and installable as a PWA. User-facing core features should be free; do not assume infrastructure is free at scale.

## 1. Essential accuracy and implementation requirements

Consult the current official documentation before implementation:

- [https://www.torn.com/api.html](https://www.torn.com/api.html)
- [https://www.torn.com/swagger.php](https://www.torn.com/swagger.php)
- [https://www.torn.com/swagger/openapi.json](https://www.torn.com/swagger/openapi.json)

Build an endpoint capability registry from the actual OpenAPI specification, supplemented by verified v1-only selections. Prefer v2 where supported. Record the version, method, path, query parameters, required permissions, privacy scope, pagination, cache behavior, refresh policy, and associated features. Cover every documented API group in the registry, but fetch only data necessary for enabled features. An endpoint browser may expose all supported read capabilities without polling everything.

Never invent endpoints, fields, historical data, API permissions, or available integrations. Label each feature's data source as official API, derived calculation, authorized third-party integration, manual input, or future work. Disable unavailable features with a useful explanation.

Torn's API is read-only, including Full Access keys. Full Access exposes additional data; it does not authorize attacks, purchases, transfers, or other gameplay actions. Links may take users to verified Torn pages where they act manually. Do not build automatic attacks, purchases, transfers, scraping behind authentication, or other prohibited gameplay automation. Verify current scripting and integration requirements.

Swagger access does not provide opponents' exact private battle stats, a global history database, comprehensive foreign-stock feeds, or another service's proprietary estimates. Those require permitted sources or independent collection. Never claim a single account key exposes private data belonging to all faction members.

Do not promise complete replacement of existing tools on launch. Comparable interfaces are achievable; equivalent historical coverage and prediction accuracy require data and validation. A website cannot insert overlays into Torn pages without a separately installed compliant userscript or extension.

## 2. Product experience and navigation

Create a polished dark dashboard with readable typography, accessible contrast, optional light mode, compact tables, clear status badges, configurable widgets, and touch-friendly interactions. Use colour plus text or icons rather than colour alone. Support keyboard navigation and reduced motion.

Navigation: Overview, Planner, Targets, Player Intel, War Room, Faction, Payouts, Travel, Markets, Company, Properties, Racing, Community, Alerts, API Usage, and Settings. Hide irrelevant modules for users without the necessary role or permission.

Every data widget must display source, last successful update, stale status, and permission requirements. Distinguish observed facts, imported reports, estimates, and predictions. Never make mock data look live. Provide a clearly marked demo account with seeded examples.

## 3. Accounts, onboarding, and privacy

Use Supabase Auth for app sign-in, then link a Torn identity by validating the submitted key server-side. Derive the player identity from the response; never request the Torn password.

Provide feature-based onboarding: personal player, new player, faction member, officer, leader, banker, or company director. Verify leadership and faction membership from authoritative data or approved administrative verification; signing up first must not confer leader access.

Generate custom-key guidance based on enabled capabilities. Show missing permissions and let users run a reduced feature set. Accept sensitive permissions only when a specific feature requires them. Provide optional modes without persistent key storage, explaining that background collection cannot continue without a server-accessible credential.

Encrypt stored Torn keys with authenticated encryption using a managed server-only secret mechanism. Keep decryption and service-role privileges out of the browser. After submission, never return raw keys to the client. Redact keys from application logs, URLs, telemetry, crash reports, and exports. Do not store keys in browser persistent storage.

At every key-entry surface, show Torn's required disclosure table: data storage and retention, sharing audience, purpose, key storage/sharing, and access level/selections. Use separate opt-ins for faction sharing, community estimate contribution, third-party integrations, and any AI processing. Never forward a Torn key to a third party silently.

Include privacy controls, data export, key replacement/removal, pause tracking, account deletion, and an accurate deletion policy covering backups and retained shared records. Private battle stats remain private unless explicitly shared with named audiences.

## 4. Personal overview and action planner

Display available bars, cooldowns, travel and hospital/jail state, education and other supported timers, events, goals, finances, battle stats, and relevant activity summaries.

Build a rules-based 'What should I do next?' panel that prioritizes enabled goals: avoid a full energy bar, prepare for a scheduled faction war, respond to a chain deadline, review available targets, or plan a trip. Each recommendation must explain its inputs and remain advisory.

Add daily/weekly plans, configurable availability, timezone-aware reminders, training goals, money targets, personal checklists, streaks, and progress charts. Explain numbers in plain language. Do not invent exact XP progress or hidden game values.

Track battle stats, personal stats, networth, training, attacks, revives, crimes, and other available histories using authorized logs or collected snapshots. Show when history collection began and label gaps.

## 5. Unified target finder and levelling lists

Support levelling, respect, chain, ranked-war, bounty, and seasonal modes. Offer curated inactive low-stat target lists, user-owned lists, faction-shared lists, favorites, notes, exclusions, and imports/exports.

Provide an authorized import path for Baldr-style lists and YATA-compatible user exports. Check licensing or obtain permission for redistribution; retain attribution. Do not copy another site's database or branding without authorization.

Display target ID/name, level, faction, latest observed status, last action where available, hospital timer where available, estimate source and age, observed fight outcomes, and a manual attack-page link. Filter by level, inactivity, location/status, estimate range, preferred FF range, exclusions, and list membership.

Add 'attackable according to last observation', target availability alerts, a manual next-target cycler, and duplicate-hit warnings. Recheck freshness before recommending a target. Future offline availability is a labelled prediction, not a guarantee.

Personalize rankings to the user's goal and permitted stats. Learn from authorized attack records with deduplication; permit annotated manual outcomes clearly distinguished from verified records. Do not infer guaranteed wins from FF alone. Account for uncertainty and factors not captured by total stats.

## 6. Combat estimates and player intelligence

Provide player profiles, FF/difficulty indicators, estimate history, faction comparisons, and evidence timelines. Store exact self-reported or authorized spy stats separately from inferred estimates.

For FF-derived estimates, validate the current documented battle-stat-score and FF relationships before implementation. Treat capped values as bounds where appropriate. Do not equate BSS directly with total battle stats or infer an exact four-stat distribution from a single FF value.

Attach source, timestamp, sample count where known, and limitations to each estimate. Use calibrated uncertainty intervals only when supported; otherwise display qualitative evidence labels. Never fabricate coverage for unknown players.

Offer optional FFScouter integration only after verifying current API terms, authentication, attribution, limits, caching, and redistribution rights. Integrations must be explicitly consented to. This reduces site-switching but remains a dependency. Independently collected estimates require opted-in contributors and a clearly disclosed data policy.

Support authorized spy report imports, provenance, age warnings, and faction-scoped access. Do not expose confidential imported reports to a public pool. Flight/arrival predictions require supported observations and must show assumptions and uncertainty.

## 7. War room and coordinated faction combat

Display supported war scores, timing, reports, chain status, own/enemy rosters, recent attacks, eligible targets, filters, and manual navigation links.

Add target assignments, officer priorities, opt-in availability, short-lived target claims, claim expiry, notes, chain milestone reminders, and anti-duplication warnings. Claims coordinate app users; they do not reserve targets in Torn. Use transactional claim acquisition and Realtime updates.

Show activity heatmaps, observed online windows, status histories, estimated combat difficulty, allied faction views, and explicit exclusions for non-aggression agreements. Limit continuous collection to opted-in or explicitly tracked scopes within permitted access.

Provide post-war contribution reports, chain reports, attack outcome summaries, configurable efficiency metrics, and authorized attack drill-downs. Do not label a player as having 'missed' a hit without explicit assignment/availability evidence.

Include optional user-managed bounty/contract records with manual settlement and eligible-hit verification where data permits. Do not claim to provide automated escrow or Torn transfers. Validate applicable rules before enabling a public contract marketplace.

## 7A. Buying and selling losses — required launch scope

Create a dedicated Loss Marketplace with Buy Losses, Sell Losses, My Contracts, Active Claim, Earnings, Payment Queue, and Disputes screens. This is a required module, separate from bounty contracts.

Buyer flow: select a target, loss quantity, Torn-cash price per accepted loss, budget, expiry, eligibility rules, and funding method. Preview the total, submit the contract, and show funding verification before labelling it prepaid. Track open, reserved, verified, rejected, expired, cancelled, paid, and refundable quantities and balances. Allow pausing and cancellation only for unreserved work; preserve seller claims and earned liabilities. Seller flow: browse funded contracts, filter by reward and target eligibility, inspect terms, choose a quantity, and claim slots atomically. Show the target, estimated suitability, remaining quota, claim countdown, qualifying loss count, expected earnings, manual Torn links, and a Mark Complete/recheck action. Provide an optional pillow-only loadout checklist and clear warnings that estimates do not guarantee an outcome. Do not change equipment or attack automatically.

Benchmark verified FFScouter behavior from [https://ffscouter.com/guides/selling-losses](https://ffscouter.com/guides/selling-losses): prepaid slots, automatic attack-log verification, one active claim per seller, first loss within five minutes, no more than five minutes between losses, and fifteen-minute total claim expiry. Its stated eligibility threshold compares seller stats to half the target's public estimate or a higher premium spy total, and excludes targets without estimates. Implement configurable equivalents with transparent sources; never substitute BSS for total stats. If reliable comparable stats are unavailable, explain the eligibility limitation rather than inventing values.

Verify seller, target, attack outcome, event timestamp, contract window, and any enforceable contract conditions using authorized API records. Deduplicate globally by attack ID so one loss cannot earn twice. Distinguish rejected evidence from pending evidence caused by API delay. Handle late-arriving records using the event time and a defined reconciliation grace period. Mark Complete triggers a recheck, never unconditional payment approval.

Release unused slots on expiry or voluntary completion. Preserve verified partial earnings. Keep reservations transactional so simultaneous claims cannot oversell a contract. Stop reserving more than the verified available funding covers.

Maintain a separate manual settlement workflow: funded balance, reserved liability, earned liability, payment approved, payment sent, reconciled, and refunded. Torn's API cannot transfer funds. Prepaid custody requires an actual disclosed operator-held in-game balance, reconciled deposits, staff settlement, and a reviewed operating policy; a database balance alone is not escrow. If launching without custody, label contracts direct-payment and never advertise prepaid protection. Do not promise an automatic payout or competitor-equivalent payment speed without staffed operations.

Include completion notifications, seller earnings history, buyer receipts, operator payout batches, overdue-payment alerts, dispute evidence, fraud flags, and an append-only audit trail. Add loss_contracts, loss_claims, loss_evidence, funding_records, settlement_entries, and loss_disputes with appropriate RLS. Test simultaneous claims, insufficient funding, duplicate evidence, late records, API outages, expired claims, partial completion, cancellation, and duplicate payments.

Include this module in Phase 3 alongside the war-payout accounting infrastructure, rather than leaving it optional or omitting it from the delivery checklist.

## 7B. Competitor coverage audit — mandatory acceptance gate

The scope is all discoverable functionality of Baldr's Levelling List, FFScouter, and Torn Intel, including their documented premium features. Do not interpret this as permission to implement only selected highlights. Before claiming full coverage, inspect their public navigation, guides, free/premium descriptions, and API documentation. Record authenticated or inaccessible behavior as unverified instead of claiming it was inspected.

Maintain a feature-by-feature coverage matrix containing competitor, source URL, date checked, exact feature, free/premium status if verified, our corresponding screen/workflow, data source, permissions, external dependency, implementation phase, acceptance test, and current status. A blocked or unverified feature must remain visible in the matrix and cannot be counted as delivered.

Explicit baseline: Baldr main lists 1–3, extra lists 1–3, DOMINO list, API-key setup, list selection, status fetch, and levelling guidance. FFScouter: player lookup, FF/stat estimates, history, activity and flight tracking, target presets, faction profiles/comparison, active wars, war room, companion overlays/filtering/appearance controls, public API, premium data sources/distribution insights, bounty placement/claims, buying and selling losses, and account/data removal. Review the separately advertised investment ROI calculator and Private Island/mortgage service and specify verified workflows before claiming parity; do not invent lending terms or operator funding. Include beginner, battle-stat, war/chaining, happy-jump, and levelling guides with original writing and verified mechanics.

Torn Intel baseline: free and Pro activity/history, profiles, personal statistics, chain and war reports, spy aggregation, multi-faction monitoring, foreign stock, departure/day planning, restock alerts, stocks and holdings, company recaps/heatmaps/staff/pricing/star forecasts, faction bank, armory history, lists/imports, transfers, raids/territories, upgrade simulation, alliances/families, chat/threads/notes, applications, Halloween tools, PWA/push, Discord, and contextual assistant. Verify detailed Pro workflows from its actual Pro documentation before marking this checklist exhaustive.

These named features are required scope items or explicitly documented dependency blockers. Previously discussed differentiators and the war payout calculator remain additional requirements. Never silently omit a competitor feature merely because it needs independent data, human operations, a permitted integration, or further verification.

## 7C. Required additions from both user-provided screenshots

Treat every item below as explicit product scope, supplementing all preceding modules. The screenshots establish feature names, not undocumented internal behavior. Build the workflows described here as our implementation requirements; do not claim these details were verified inside the competitors. Inherit all free-module functionality in the unified offering. Do not put these features behind a user paywall by default.

### First screenshot: More Tools

- Target Finder: dedicated navigation entry for the complete target finder in Section 5, including saved filters, list management, live-status freshness, and manual attack links.
- Factions: dedicated hub for search, profiles, member tables, comparisons, war history, watched factions, and authorized management. Expandable navigation must lead to real working screens.
- Player Viewer: searchable player profile with supported personal/public stats, observed activity, estimate history, authorized spy evidence, faction context, and configurable date ranges.
- Compare Players: dedicated side-by-side comparison of two or more selected players with matching stat definitions, date windows, absolute and percentage differences, available battle-stat distributions, activity, war performance, source timestamps, and saved comparison sets. Private stats require explicit access. Mark missing values unknown rather than zero; do not infer exact distributions from total-stat estimates.
- Leaderboards: dedicated hub with selectable eligible population, metric, date range, faction/alliance/community scope, personal rank, ties, and saved presets. Offer supported war contribution, personal-stat growth, activity, and opt-in financial or training metrics. Distinguish official rankings from app-only rankings; show coverage and eligibility. Review actual competitor submenu categories separately instead of inventing them.
- Investment ROI Calculator: dedicated interactive calculator comparing supported stock benefits, bank-interest scenarios, properties/rentals, companies, and user-entered investments. Accept capital, fees, recurring costs, benefit timing, reinvestment assumption, horizon, and item valuation basis. Show net profit, simple ROI, comparable annualized return where meaningful, payback period, cash-flow schedule, and sensitivity scenarios. Separate guaranteed contractual inputs from variable market estimates. Validate mechanics and rates from permitted current sources; allow labelled manual inputs where unavailable.
- PI Mortgages: dedicated Private Island financing workspace. Include affordability and rent-versus-buy scenarios, down payment, principal, payment interval, rate convention, interest method, term, fees, upkeep, payment schedule, outstanding balance, total cost, and early-payoff calculation. All terms are explicit configurable inputs, not invented competitor offers. Add application, review, accepted agreement, document/notes, manual funding confirmation, installment ledger, arrears notices, settlement, and dispute flows. No automatic loans, property transfers, repayments, invented lenders, or guaranteed collateral enforcement. A live lending service requires actual lenders, disclosed custody/collateral arrangements, operational review, and manual in-game execution. Keep the calculator usable without an operational lending marketplace.
- Losses: expose Buy Losses, Sell Losses, My Contracts, Active Claim, Earnings, and Payment Queue as appropriate to role, implementing Section 7A in full.
- Bounties: dedicated placement and claim screens for player/faction-target contracts, price per qualifying hospitalization, count, expiry, funding evidence, available work, attack verification, progress, settlement, and disputes. Support buyer anonymity toward sellers only if offered and enforce it consistently; administrators still need audit access. Clearly distinguish app contracts from official Torn bounties. Reuse transactional reservations and evidence deduplication where applicable. Review exact competitor submenus separately.

### Second screenshot: complete listed feature set

1. Everything in Free: all baseline functionality stays available alongside these advanced modules. Maintain one combined capability matrix; do not omit an earlier module when adding these features.
2. Ranked war tracker and payouts: provide the war dashboard and full audited payout workflow in Sections 7 and 8, linked from the same war record. Include provisional and finalized reports, contribution evidence, policy versions, approval, payment reconciliation, and member statements.
3. 217+ stats with all time periods: build a searchable, categorized stat catalog, targeting at least 217 distinct meaningful metrics only where verified source fields or explicitly documented derivations support them. Include favourites, tooltips, units, historical snapshots, deltas, charts, and configurable periods: today, yesterday, current/previous week, 7/30/90 days, month, year, all recorded history, and custom ranges. Distinguish lifetime totals from changes during a selected interval. Show unavailable history as unavailable. Do not pad the count with duplicate metrics or claim all historical periods before collection began. Report the verified metric count and any shortfall in the coverage matrix.
4. Faction comparison and battle stats distribution: compare rosters, size, observed activity, supported war records, and authorized battle-stat data. Show histograms, percentiles, medians, strongest-member concentration, estimate age, and missing-data coverage. Distinguish distribution across members from a player's strength/defense/speed/dexterity split. Estimated faction totals must state coverage and uncertainty; never substitute missing members with zero.
5. Spy players and PvP: dedicated player-intelligence workspace combining authorized spy reports, battle-stat evidence, relevant attack histories, opponent comparisons, and encounter notes. Provide source attribution, timestamps, access controls, stale warnings, report import, and conflict handling. A spy report viewer does not perform an in-game spy action or expose unavailable private data.
6. Up to 30 watched factions: allow each authorized workspace to configure up to 30 watched factions, subject to its stated collection budget. Include watch/unwatch, priorities, refresh settings, comparison groups, history, notifications, and pause states. Reuse public observations where permitted; watching never grants access to faction-private data. Explain reduced refresh under budget limits instead of pretending all 30 are continuously live.
7. Dibs (beta) and enemy loadouts: implement short-lived target claims with actor, expiry, release, officer override, conflict prevention, and realtime visibility. Add enemy-loadout evidence for weapons, armor, and relevant modifiers only when legitimately available from permitted reports, observations, imports, or manual notes. Display provenance and age. Mark unknown loadout slots unknown; do not assume public profile endpoints reveal equipment. Dibs cannot stop other Torn players attacking.
8. Recruitment scanner: leaders define requirements and scan an authorized candidate list or supported search results. Compare available level, activity, tenure/history coverage, stats, faction status, and other permitted metrics; show match reasons, unknown fields, notes, review stages, shortlist, and manual contact links. Obtain consent for private applicant data. Do not fabricate recruitment availability, private battle stats, or unsupported global search.
9. Chain and war alerts: configure start/end reminders, chain timeout warnings, milestones, observed score thresholds, assignments, and eligible target-status changes. Include quiet hours, role/channel permissions, rate limits, delivery logs, stale-input handling, and deduplication.
10. Custom stat columns and presets: let users choose, reorder, resize, pin, hide, sort, and filter columns in player/faction/war tables. Save named presets and share them within authorized scopes. Validate allowed formulas without arbitrary code execution. Persist display preferences and metric definitions without exposing private data through shared presets.
11. Gym tracker: show permitted training events or snapshots, stat growth, training spend, energy/happiness inputs where actually recorded, gym progression, goals, and estimated gains per energy/cost. Distinguish observed gym gains from changes caused by other sources. Do not reconstruct exact training history from insufficient snapshots. Add session/day/week/month/custom reports and explanatory training scenarios based on verified mechanics.
12. Activity heatmaps: hourly and weekday heatmaps, timezone switching, player/faction comparisons, observed online/idle/offline intervals, and history range controls. Show polling gaps and distinguish observed intervals from exact time played. Historical activity requires collection or authorized imports.
13. TornStats spy integration: build an explicit opt-in adapter after verifying TornStats' current API, authentication, permissions, sharing rules, and allowed caching. Support authorized report lookup/import, deduplication, timestamps, provenance, refresh, revoke/disconnect, and integration errors. Keep Torn and TornStats credentials separate and protected. Do not assume a Torn key automatically authorizes TornStats access. Provide manual authorized imports if integration access is unavailable.
14. Full alliance and family views: represent alliances and sister-faction families, verified administrators, membership invitations, faction grouping, aggregate rosters, comparison dashboards, shared watchlists, wars, reports, calendars, and scoped announcements. Show incomplete data coverage. Share private intelligence only through explicit grants; revoke access promptly on membership changes.
15. Graffiti wall: add a collaborative faction/alliance wall with short text posts, optional safe drawing or image uploads, timestamps, reactions, pinned notices, moderation, and role-based posting/viewing. Treat this as an app feature unless a supported Torn capability is verified. Sanitize text, validate uploads, cap storage, and support abuse reporting and deletion.
16. CSV/Excel export and shareable reports: export permitted table/chart/report data as CSV and genuine XLSX with clear metric definitions, periods, sources, and freshness. Prevent spreadsheet formula injection. Provide revocable, expiring, optionally authenticated report links, with audience selection and private-field redaction. Never include API keys. Clearly label immutable report snapshots versus live report views.
17. AI war analyzer and payout planner: summarize authorized war evidence, highlight supported contribution patterns, compare payout-policy scenarios, flag anomalies for human review, and generate officer/member explanations with traceable evidence. Use deterministic accounting for every monetary calculation; AI must not allocate unchecked amounts, infer unavailable intent, authorize payments, or rewrite approved policies. Show recommendations separately from decisions and require leader approval. Provide equivalent non-AI summaries and calculators when an AI provider is unavailable or not consented to.

### Integration into architecture, navigation, and delivery

Add first-class navigation for Compare Players, Leaderboards, ROI Calculator, PI Mortgages, Losses, and Bounties; add recruitment, gym, graffiti, watched-faction management, and reports to their relevant hubs. Ensure mobile navigation exposes every required screen.

Extend the schema with comparison_sets, leaderboard_presets, metric_definitions, stat_presets, watched_factions, loadout_evidence, recruitment_candidates, recruitment_reviews, training_events, integration_connections, spy_import_jobs, graffiti_posts, graffiti_assets, report_snapshots, report_share_grants, investment_scenarios, mortgage_applications, mortgage_agreements, and mortgage_installments. Use RLS and audit controls consistent with the rest of the platform. Share financial infrastructure rather than duplicating incompatible balances.

Schedule player comparisons, leaderboards, stat presets, and ROI calculator with the target/intelligence phase; watched factions, recruitment, loadout evidence, advanced war analysis, and payout planning with the war/faction phase; gym, alliance/family, TornStats integration, exports/reports, graffiti, and PI mortgage workflows with the corresponding expanded modules. Keep every item on the delivery checklist even if operational prerequisites block its release.

Acceptance tests must cover private-data leakage in comparisons, incomplete faction coverage, time-window boundary calculations, saved preset permissions, 30-faction budget scheduling, concurrent dibs, unverified loadout entries, integration revocation, malformed uploads, expired share links, CSV/XLSX injection, mortgage arithmetic and arrears, and AI advice that conflicts with deterministic payout results. Do not claim these two screenshot checklists are complete until each item has a functioning tested workflow or an explicitly visible blocker.

## 8. Complete war payout calculator

Build an auditable payout workspace linked to a specific war. Leaders publish and version a policy before the war, import supported reports, review classifications, calculate allocations, approve them, and track manual payments.

Revenue must be actual Torn-cash proceeds from sold rewards plus explicit contributions or carry-over. Respect is not cash. Separate unsold-reward estimates from realized proceeds, and prevent duplicate sale entries. Leaders can manually enter sales or import verified records when supported.

Recommended pot policy: deduct documented eligible costs from realized revenue, then apply the member-pool percentage to net proceeds. Offer an explicitly labelled gross-revenue alternative. Show faction reserve, reimbursements, bonuses, participant pool, and retained remainder separately so nothing is deducted or allocated twice.

Allow mutually exclusive payout modes:

- Equal payment per eligible hit.
- Proportional payment by a supported contribution measure.
- Weighted points for configurable categories such as ranked-war wins, qualifying chain hits, assists, or approved support work.
- Hybrid: a budgeted participation amount plus proportional distribution of the remainder.

Do not assume the ranked war report includes every needed field. Map verified report fields and supplement with authorized detailed attack records or manual reviewed entries. Make overlapping categories and bonus hits explicit to avoid unintended double counting.

Let leaders set eligibility, minimum participation, category weights, optional penalties, approved bonuses, reimbursements, exclusions, and caps. Show all members their calculation basis. Prefer no default punishment for losses or support roles. Optional penalties must never produce negative pay.

Without caps, allocate the distributable pool in proportion to nonnegative eligible points. Handle zero total points without division by zero. Validate floors against the available pool. Floors, caps, bonuses, and reimbursements need an explicit order of operations.

For capped proportional allocation, repeatedly cap members above their limits and redistribute only among uncapped eligible members. Detect infeasible caps: three participants each capped at 25% can receive at most 75% of the pool. Retain the remainder or require a policy change; never exceed caps or loop forever. Use integer Torn cash and exact arithmetic. Round down initial proportional allocations, then allocate remaining currency units using largest fractional remainders and a deterministic tie-breaker, respecting caps. If constraints prevent full allocation, record the undistributed reserve explicitly.

Live preview columns: player, eligible categories/counts, points, share, bonus, reimbursement, adjustment, amount owed, paid, balance, and explanation. Keep estimated payouts separate from approved final amounts.

Workflow: draft policy -> published policy -> imported evidence -> reviewed adjustments -> locked calculation -> officer approval -> manual payment -> reconciliation. Changes after locking create a new version and adjustment entries, not a silent rewrite.

Include CSV export, member statements, verified Torn navigation links, payment notes/evidence, duplicate-payment detection, idempotency, dispute review, and an append-only audit trail. Marking a row paid is a manual ledger action unless corroborated by accessible transaction evidence. No API auto-payment.

## 9. Faction operations

Provide member roster, join/leave tracking, retention trends, observed activity heatmaps, authorized personal-stat comparisons, chain performance, applications review, onboarding checklists, shared notes, threaded chat, and mentions.

Implement member/banker money requests, approval queues, manual payment reconciliation, ledger, dues tracking, armory inventory/history, loans, and approved cost records using supported data. Preserve accounting consistency.

Add organized-crime planning, member availability, assignments, readiness where exposed, raids, territory views, faction upgrade simulation, and respect-cost scenarios. Maintain versioned reference data and label calculations.

Support alliances and sister factions with explicit invitations and scoped sharing. Revoke faction-private access when membership or role changes. Show transfers only from observations you collected or authorized imports; do not claim complete historical transfers.

## 10. Travel, markets, stocks, and money

Travel planner: compare destinations, trip duration, carrying capacity, known prices, budget, trip profit, estimated profit per hour, and schedule conflicts. Add landing alerts, departure planning, and travel history.

Foreign stock and restock forecasts require a verified official capability or permitted contributor/integration feed. Show observation age, sparse coverage, and forecast error. Do not label stale observations as live or guarantee stock on arrival.

Market tools: item catalog, watchlists, price thresholds, comparison views, historical charts from collected data, bazaar comparisons where supported, points-market tools if exposed, and estimated margins with fees and liquidity assumptions. Ask for manual action in Torn; no automatic buying.

Stocks: holdings, supported price data, benefit eligibility, cost and return scenarios, and historical ranges when available. Separate cash returns from estimated item-benefit valuations. Networth and portfolio charts must avoid double counting assets.

Properties: owned property overview, upkeep where available, rental comparisons, upgrade scenarios, and return calculations. Company tools: director-authorized dashboards, employees, daily profit, trends, inventory where available, staffing scenarios, pricing notes, and explainable forecasts. Never present an unvalidated forecast as a guaranteed star rating.

## 11. Racing, reference data, and seasonal tools

Add racing profiles, car and track reference information, supported race results, personal records, and performance comparisons. Do not expose unfinished-race data the API withholds.

Provide browsable Torn reference data, supported forum/news content, calendar reminders, and event tools. Halloween mode may include curated targets, observed hospital windows, a basket guide, and a calculator based on verified mechanics. Sensitive personal logs remain optional.

## 12. Alerts, companion integrations, and community

Build a unified alert center with per-event switches, conditions, severity, quiet hours, timezone, cooldowns, deduplication, digests, and delivery history. Support in-app messages and opt-in web push; add email and Discord through documented integrations with operating costs disclosed internally.

Example conditional alert: a tracked target is observed available, the user's last observed energy exceeds their configured threshold, and the current time is outside quiet hours. If inputs are stale, show that or defer the alert.

Discord features: verified account linking, faction-scoped commands, role checks, members/bank/activity/price summaries, and private notification routing. Never expose sensitive data to an unverified channel.

Offer a separately packaged, optional compliant userscript/extension for Torn-page FF badges, profiles, faction/war sorting, mini-profiles, target cycling, and quick links. Use short-lived app tokens where possible, never Supabase service-role credentials. Check TornPDA compatibility rather than promising it.

Community: opt-in shared target lists, quality reports, moderation, mentors, beginner checklists, and privacy-respecting leaderboards. Add portable CSV/JSON imports/exports and a rate-limited public API exposing only explicitly public or licensed data.

Optional natural-language assistant: answer questions from authorized app records with traceable evidence. Use deterministic calculations for money and payouts. Never send raw API keys or private data to an AI provider without disclosure and consent. Keep rules-based summaries fully usable without an AI service.

## 13. Supabase architecture and data model

Use migrations, database constraints, server-side authorization, and tested RLS. Suggested entities:

- profiles, linked_torn_accounts, encrypted_credentials, consents, feature_permissions.
- factions, memberships, roles, alliances, sharing_grants.
- api_capabilities, sync_jobs, request_budgets, cached_responses, sync_errors.
- player_observations, stat_snapshots, attack_records, estimates, spy_reports.
- target_lists, target_list_entries, target_claims, assignments, notes.
- wars, chain_reports, war_evidence, payout_policies, policy_versions.
- revenue_entries, expense_entries, payout_runs, payout_lines, payment_entries, disputes.
- faction_accounts, ledger_entries, bank_requests, armory_events.
- goals, plans, watchlists, market_snapshots, stock_holdings, travel_observations.
- company_snapshots, property_records, racing_records.
- notification_rules, notification_events, delivery_attempts, push_subscriptions.
- chat_threads, messages, applications, import_jobs, audit_events.

Use external Torn IDs alongside internal primary keys. Deduplicate external events using stable IDs. Separate private/raw evidence from permitted aggregates. Partition or aggregate high-volume observations when justified. Use retention policies and daily rollups instead of indefinite raw snapshots.

Scheduled jobs enqueue bounded work; workers fetch, validate, paginate, deduplicate, store, and enqueue notifications. Do not run an endless loop inside an Edge Function. Use leases, retry limits, exponential backoff, and idempotent writes. Realtime broadcasts app changes; it does not make Torn data update instantly.

Share cached public responses only where licensing and consent allow. Scope private caches by owner/faction and permissions to prevent cross-tenant leaks. Track a per-Torn-user budget across their keys, leaving headroom for other tools. Verify current rate limits at implementation time. Repeated invalid/paused keys must stop polling; permission errors should disable only affected capabilities when possible.

## 14. Sustainability and differentiation

Prioritize actionable recommendations, transparent estimates, explainable payouts, coordination without duplicate work, privacy, and fast mobile interactions. Do not claim features are unique without checking competitors.

Start with active-session refresh and selected background tracking. Use slow refresh for reference data, economical observation intervals for history, and temporary higher-frequency war mode within limits. Prefer configurable retention, aggregated history, and bounded tracked lists over unlimited polling.

Provide an administrator cost dashboard: API requests, storage growth, worker invocations, notification delivery costs, cache hit rate, and estimated cost per active faction. Free for users does not mean unlimited free hosting. Do not add ads, paid plans, or real-money donations without checking Torn's current permission requirements.

## 15. Delivery sequence and acceptance criteria

Deliver in coherent phases without redesigning the underlying data model each time:

1. Secure onboarding, capability registry, private dashboard, demo mode, basic planner, and custom/authorized levelling lists.
2. Target rankings, optional estimate integration, alert center, and observation history.
3. War room, claims, reports, full payout calculator, faction roles, and ledger.
4. Travel/markets/company/property/racing modules, alliances, imports/exports, and Discord.
5. Independent estimate contribution, validated predictions, optional companion script, and assistant.

For each phase deliver working UI flows, migrations, RLS policies, server functions, validation, tests, configuration guidance, and explicit data-source requirements. If external credentials are absent, preserve a functional labelled demo and useful setup instructions; never fabricate production connections.

Critical tests: cross-user/faction access denial; key redaction; revoked-role access removal; stale data; pagination; duplicate events; API limits; invalid keys; concurrent target claims; notification deduplication; midnight/timezone handling; payout zero points; negative net proceeds; floors exceeding budget; infeasible caps; integer rounding; repeated imports; duplicate payments; and locked-policy amendments.

The payout preview must reconcile: allocated member payments plus retained remainder equals the defined distributable budget. The financial view must reconcile revenue, costs, reserves, liabilities, and paid amounts without treating unsold rewards as realized cash.

Start implementation with the shared architecture, capability verification, and Phase 1. Continue through the planned phases as execution capacity permits; keep a clear delivered/pending checklist rather than claiming an incomplete platform is finished.

## 16. AI provider choice — user-supplied keys (added in chat)

For the AI war analyzer, do **not** use a shared/operator-held `AI_PROVIDER_API_KEY`. Instead:

- Let each user choose **OpenAI** or **Gemini** as their AI provider.
- Ask the user to submit their **own** API key (OpenAI `sk-...` or Gemini `AI...`) via a Settings page.
- Validate key format client-side and server-side.
- Encrypt the key server-side with AES-GCM using `TORN_KEY_ENCRYPTION_KEY` before storing in `encrypted_credentials` with a `provider` column (`torn` / `openai` / `gemini`).
- Never return, log, or expose the raw key to the client after submission.
- The `analyze-war-ai` Edge Function must read the **user's own** key (by `provider`) — never a global secret.
- Provide a "How do I get a key?" help panel with step-by-step instructions and direct links to OpenAI (platform.openai.com/api-keys) and Gemini (aistudio.google.com/app/apikey) key creation pages.
- Provide a "Remove key" action that deletes the credential and locks AI mode.
- Keep the rules-based (non-AI) analyzer fully functional as the default; AI mode is an opt-in unlock.
- Edge Functions required: `link-ai-key` (encrypt + upsert), `remove-ai-key` (delete), `analyze-war-ai` (read user key by provider, call OpenAI or Gemini).

## 17. Revive marketplace and chain queue (added in chat)

In addition to the Loss Marketplace, build:

- **Chain Target Queue:** users add targets by Torn ID, claim slots for 5 minutes, mark hit/skip, release claims. Status flow: open → claimed → hit/skipped. Table: `chain_target_queue` with owner-only RLS.
- **Revive Tracker:** log revives given/received with reviver/target attribution and type (normal/medical/event); surface top revivers over 30 days. Table: `revive_logs` with owner-only RLS.
- **Revive Marketplace:** buyers post revive requests (target, quantity, price per revive), sellers claim slots (15-min expiry), mark complete. Tables: `revive_contracts`, `revive_claims`, `revive_evidence` with owner-only RLS. Realtime Supabase subscriptions for live updates. Optimistic UI for claims.
- **Daily Digest:** one-click morning snapshot aggregating loans, chain status, travel opportunities, and open chain targets. Table: `daily_digests` with owner-only RLS.

## 18. Operator role and settlement automation (added in chat)

For the Loss Marketplace payment workflow:

- Add a `role` column to `profiles` with values `user` / `payment_operator` / `admin`.
- `payment_operator` and `admin` get elevated RLS access to `loss_settlement_entries` (full read/write) and `loss_disputes` (full read/write), plus read-only access to `loss_funding_records` and `loss_attack_evidence` for audit.
- Build an **Operator Dashboard** (role-gated) showing: pending funding, earned → approved → sent → reconciled settlement queue across all sellers, and open disputes with resolve/reject actions.
- Automate funding detection via a `verify-loss-funding` Edge Function: poll the operator account's item log for Xanax (item 206) transfers matching `loss:<contract_id_prefix>` message codes; auto-verify and flip contract status to `open`.
- Automate attack verification via a `verify-loss-payment` Edge Function: poll the seller's attack log via their own Limited Access API key; match by attacker/defender/timestamp window; dedupe by `attack_id`; verify `outcome === 'loss'`; increment `amount_owed` on the settlement entry.
- Schedule both via pg_cron: `verify-loss-funding` every 5 minutes, `verify-loss-payment` every 2 minutes, using `pg_net.http_post` with the service-role key.
- The actual Torn cash transfer from operator → seller remains a **manual** in-game action; the app only tracks the ledger (`earned → approved → sent → reconciled`).

---

## Implemented (as of this chat)

| Feature                                                                                                                  | Status |
| ------------------------------------------------------------------------------------------------------------------------ | ------ |
| App shell, nav, dark/light theme, PWA                                                                                    | ✅      |
| Supabase Auth + Torn key linking (encrypted)                                                                             | ✅      |
| Overview, Planner, Targets, Compare Players, Leaderboards                                                                | ✅      |
| ROI Calculator, PI Mortgages, Bounties                                                                                   | ✅      |
| Stats Catalog (224 metrics), Custom Stats, Stat Intelligence, Stat Growth                                                | ✅      |
| Spy Reports, War Hits, Crime Tracker, Flight Tracker, Dibs, Target Pools                                                 | ✅      |
| Tornipedia, Assistant, Discord, Notification Prefs, Alerts, Notifications                                                | ✅      |
| War Room, War Analyzer, AI War Analyzer                                                                                  | ✅      |
| Payouts, Losses (Loss Marketplace), TornStats                                                                            | ✅      |
| Travel, Travel Optimizer, OC Planner                                                                                     | ✅      |
| Markets, Stocks, Company, Properties, Racing, Community, Live Feeds                                                      | ✅      |
| Alliances, Watched Factions, Recruitment, Gym, Activity, Graffiti                                                        | ✅      |
| Reports, API Usage, Public API, Admin Cost Dashboard, Competitor Matrix, Halloween                                       | ✅      |
| Faction, Faction Finance, Faction Upgrades, Alliance Sharing, Retention Trends, Armory History, Loan Reminders           | ✅      |
| Chain Target Queue                                                                                                       | ✅      |
| Daily Digest                                                                                                             | ✅      |
| Revive Tracker                                                                                                           | ✅      |
| Revive Marketplace (contracts, claims, evidence, realtime, optimistic UI)                                                | ✅      |
| Loss payment automation (funding detection, attack verification, settlement ledger, disputes)                            | ✅      |
| Settlement Queue + Disputes UI                                                                                           | ✅      |
| Operator role + RLS + Operator Dashboard                                                                                 | ✅      |
| AI provider choice (OpenAI/Gemini), user-supplied keys, link/remove Edge Functions                                       | ✅      |
| `analyze-war-ai` updated to use user's own key                                                                           | ✅      |
| AI Settings page wired into nav/App                                                                                      | ✅      |
| Edge Functions deployed (`verify-loss-payment`, `verify-loss-funding`, `link-ai-key`, `remove-ai-key`, `analyze-war-ai`) | ✅      |
| pg_cron schedules for funding + payment verification                                                                     | ✅      |
| Payout workflow integration tests                                                                                        | ✅      |
| Edge Function integration tests                                                                                          | ✅      |
| Deploy script (`scripts/deploy-functions.sh`)                                                                            | ✅      |
| `.env.example` + `package.json`                                                                                          | ✅      |

## Leftover / not yet done

| Item                                                            | Status         | Notes                                                                                                                                                                          |
| --------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `link-openai-key` Edge Function                                 | ⚠️ Superseded  | Replaced by `link-ai-key` (supports both OpenAI + Gemini) — the AiSettings UI still references `link-openai-key` in one place and needs updating to call `link-ai-key` instead |
| Concurrent claim race tests                                     | ❌ Not built    | Two sellers claiming the last slot simultaneously                                                                                                                              |
| Late-arriving attack record / reconciliation grace period tests | ❌ Not built    | Spec calls for this; not yet implemented                                                                                                                                       |
| Torn API mocking in Edge Function tests                         | ❌ Not built    | Currently tests hit live Torn API (fails gracefully if no real key)                                                                                                            |
| Full competitor coverage matrix audit                           | ⚠️ Partial     | Feature list exists but per-feature verification against Baldr/FFScouter/Torn Intel docs not fully audited                                                                     |
| Some UI pages still marked "soon" in nav                        | ⚠️ Minor       | A few nav entries show "soon" tag despite pages existing (wiring gaps)                                                                                                         |
| `app.settings.service_role_key` verification                    | ⚠️ Needs check | Cron jobs reference this setting; confirm it's populated                                                                                                                       |
| Realtime enabled on `revive_contracts`/`revive_claims` tables   | ⚠️ Needs check | Supabase dashboard toggle needed for subscriptions to fire                                                                                                                     |

---

This is the complete, up-to-date prompt reflecting everything built in this session plus the remaining gaps.