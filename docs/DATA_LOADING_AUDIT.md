# Account data-loading audit — 12 November 2026

Scope: inspected the navigation, page components, key selectors, private observation restoration, shared Torn gateway, and server quota/concurrency controls. This is a source and automated-test audit, not a claim that every player role or real Torn response was tested.

## Findings and repairs

- The dashboard previously selected a request-only key and did not fetch initial observations. The login preparation pass now owns initial collection; the dashboard reuses it without a second automatic pass.
- Data Browser, Compare Players, Travel, Item Catalogue, Targets and History now use the same account-aware key-mode hook. An explicit selection remains under the user's control.
- Native tool pages previously linked away to data. Twenty-nine related pages now render their prepared official observations with collection timestamps, errors and an individual refresh action. Generic endpoint links and missing crime-ID links were replaced by explicit supported sections.
- Manual notes, saved calculations, marketplace contracts, spy evidence and historical logs remain their existing app records. A current API response cannot establish missing historical records or an unknown player's private data.
- Preparation sends 95 distinct, fully parameterized requests, paced 600ms apart with at most five in flight. It uses the encrypted server key and never puts a raw key in query keys or browser persistence. The explicit preparation refresh bypasses recent-response reuse, while normal tools keep cache reuse.
- The preparation deadline is 60,000ms. Outstanding work is canceled at the deadline; the ready tick appears for 1,200ms before the workspace opens. The UI counts sent, loaded, unavailable and unfinished requests independently. Authentication/key or quota failures halt further work without restarting the timer or retrying beyond the budget.
- Existing server checks still enforce authentication, linked identity, tracking pause, credential encryption, per-user/IP quotas and six concurrent upstream leases. The preparation client stays below the six-lease limit. Other Torn apps and background jobs can reduce the available shared player quota.
- Shared report URLs bypass private preparation. Account changes clear private queries and cancel pending requests; session refresh and page navigation do not restart a completed pass for the same app instance.

## Page inventory

| Page | Data-loading path | Prepared data or behavior |
| --- | --- | --- |
| Overview | Prepared essentials and connected datasets | Profile, bars, cooldowns, travel; all 95 sections available below |
| Planner | Prepared official data + saved tool records | `/user/battlestats`, `/user/workstats` |
| Targets | User-selected IDs; shared key and observation gateway | No guessed players; explicit lookup/compare/refresh |
| Compare Players | User-selected IDs; shared key and observation gateway | No guessed players; explicit lookup/compare/refresh |
| Leaderboards | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| ROI Calculator | Reference, calculation, or component-owned action | No automatic Torn request required by the page itself |
| PI Mortgages | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| Bounties | Prepared official data + saved tool records | `/user/bounties` |
| Stats Catalog | Reference, calculation, or component-owned action | No automatic Torn request required by the page itself |
| Custom Stats | Prepared official data + saved tool records | `/user/personalstats` |
| Stat Intelligence | Prepared official data + saved tool records | `/user/personalstats`, `/user/battlestats` |
| Stat Growth | Prepared official data + saved tool records | `/user/personalstats` |
| Spy Reports | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| War Hits | Prepared official data + saved tool records | `/user/attacks` |
| Crime Tracker | Prepared official data + saved tool records | `/user/skills`, `/user/personalstats` |
| Flight Tracker | Prepared official data + saved tool records | `/user/travel` |
| Dibs | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| Target Pools | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| Tornipedia | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| Player Guides | Reference, calculation, or component-owned action | No automatic Torn request required by the page itself |
| Assistant | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| Discord | Reference, calculation, or component-owned action | No automatic Torn request required by the page itself |
| Notification Prefs | Reference, calculation, or component-owned action | No automatic Torn request required by the page itself |
| TornStats | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| Player Intel | User-selected IDs; shared key and observation gateway | No guessed players; explicit lookup/compare/refresh |
| War Room | Prepared official data + saved tool records | `/faction/chain`, `/faction/members` |
| War Analyzer | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| AI War Analyzer | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| AI Settings | Reference, calculation, or component-owned action | No automatic Torn request required by the page itself |
| Faction | Prepared official data + saved tool records | `/faction/basic`, `/faction/members`, `/faction/chain` |
| Faction Finance | Prepared official data + saved tool records | `/faction/balance` |
| Faction Upgrades | Prepared official data + saved tool records | `/faction/upgrades` |
| Alliance Sharing | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| Retention Trends | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| Armory History | Prepared official data + saved tool records | `/faction/news` |
| Loan Reminders | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| OC Planner | Prepared official data + saved tool records | `/user/organizedcrime`, `/faction/crimes` |
| Chain Queue | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| Daily Digest | Prepared official data + saved tool records | `/user/bars`, `/user/cooldowns` |
| Revive Tracker | Prepared official data + saved tool records | `/user/revives` |
| Revive Marketplace | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| Settlement Queue | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| Operator Dashboard | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| Alliances | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| Watched Factions | Prepared official data + saved tool records | `/faction/basic` |
| Recruitment | Prepared official data + saved tool records | `/faction/basic` |
| Gym | Prepared official data + saved tool records | `/user/gym`, `/user/battlestats` |
| Activity | Prepared official data + saved tool records | `/user/events` |
| Graffiti | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| Payouts | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| Losses | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| Travel | Prepared official data + saved tool records | `/user/travel` |
| Travel Optimizer | Prepared official data + saved tool records | `/user/travel` |
| Markets | Prepared official data + saved tool records | `/user/inventory`, `/market/pointsmarket` |
| Stocks | Prepared official data + saved tool records | `/user/stocks`, `/torn/stocks` |
| Company | Prepared official data + saved tool records | `/company/profile`, `/company/employees`, `/company/stock` |
| Properties | Prepared official data + saved tool records | `/user/properties`, `/user/property` |
| Racing | Prepared official data + saved tool records | `/user/races`, `/user/racingrecords` |
| Community | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| Lucky Draws | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| Live Feeds | Prepared observations + explicit section lookup | Account-scoped cache; automatic saved-key selection |
| Alerts | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| Notifications | Prepared official data + saved tool records | `/user/notifications` |
| Reports | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| API Usage | Reference, calculation, or component-owned action | No automatic Torn request required by the page itself |
| Public API | Reference, calculation, or component-owned action | No automatic Torn request required by the page itself |
| Admin Cost Dashboard | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |
| Competitor Matrix | Reference, calculation, or component-owned action | No automatic Torn request required by the page itself |
| Halloween | Prepared official data + saved tool records | `/user/competition` |
| Settings | Saved app records / explicit action | Existing owner-scoped database or action flow; no invented API history |

## Acceptance checks

Automated checks cover all 95 request identities against the gateway compiler, coverage for every mapped page endpoint, 60-second timing, no early completion, pacing, concurrency, cancellation, partial permission failures, rate-limit stopping, cache reuse, explicit fresh requests, account separation, shared reports, key defaults and display of collected data on a tool page. No test needs a real user's Torn key.

Limit: 95 successful upstream responses cannot be guaranteed in a fixed minute when Torn is slow, a key lacks selections, a faction/company role is missing, or the shared player quota is exhausted. The loader reports these cases rather than claiming that all data loaded. Real-key acceptance across every player role remains a deployment follow-up.
