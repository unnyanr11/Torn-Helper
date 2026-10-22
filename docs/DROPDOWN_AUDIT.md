# Dropdown audit — 2026-10-22

Every TSX page and shared component was inventoried. Counts are source controls, not the number of rows produced by a repeated form. API section options are shared through ApiParameterField.

137 page input controls now use dropdowns or the multi-target picker. Shared travel/API controls were also converted. Numeric choices are optional form presets, never account observations. Existing values absent from a catalogue remain selectable; exact custom values retain the original input constraints.

Choices reuse the current user’s existing private cache query and records already loaded by each page. No schema changes, new write paths, API-key storage or external connections were introduced. Empty or failed cache reads leave custom entry available. Matching ID choices fill corresponding name fields where the form has a pair. Item category filters use the collected Torn catalogue. Target pools allow adding/removing several IDs.

Text remains for new entity names, original reports/posts, descriptions, notes, transaction references and unrestricted API strings. Passwords, file upload controls, date/time calendars and checkboxes retain their appropriate native controls. Operator settlement prompts collect transaction references and resolution reasons, which require original text. Disabled integration pages remain inaccessible. No field was removed.

| Page / component | Dropdown controls | Native pickers / toggles / passwords | Remaining text / custom fields |
| --- | ---: | ---: | --- |
| src/pages/Activity.tsx | 4 | 0 | None |
| src/pages/AdminCostDashboard.tsx | 0 | 0 | None |
| src/pages/AiSettings.tsx | 0 | 0 | None |
| src/pages/AiWarAnalyzer.tsx | 1 | 0 | Paste war evidence JSON (e.g. attack records, chain data) |
| src/pages/Alerts.tsx | 2 | 0 | None |
| src/pages/AllianceSharing.tsx | 4 | 0 | None |
| src/pages/Alliances.tsx | 0 | 0 | Alliance name; Tag (optional); Title; Body |
| src/pages/ApiUsage.tsx | 1 | 0 | None |
| src/pages/ArmoryHistory.tsx | 8 | 1 | Notes (optional); Notes (optional) |
| src/pages/Assistant.tsx | 0 | 0 | Ask the assistant… |
| src/pages/Bounties.tsx | 4 | 0 | Notes (optional) |
| src/pages/ChainQueue.tsx | 3 | 0 | Notes (optional) |
| src/pages/Community.tsx | 1 | 0 | Title; Body |
| src/pages/Company.tsx | 3 | 0 | None |
| src/pages/ComparePlayers.tsx | 4 | 1 | None |
| src/pages/CompetitorMatrix.tsx | 0 | 0 | None |
| src/pages/CrimeTracker.tsx | 3 | 0 | None |
| src/pages/CustomStats.tsx | 5 | 0 | None |
| src/pages/DailyDigest.tsx | 0 | 0 | None |
| src/pages/Dibs.tsx | 3 | 0 | None |
| src/pages/Discord.tsx | 0 | 0 | None |
| src/pages/Estimates.tsx | 1 | 0 | None |
| src/pages/FactionFinance.tsx | 6 | 0 | Description (optional) |
| src/pages/FactionOps.tsx | 11 | 0 | None |
| src/pages/FactionUpgrades.tsx | 4 | 0 | Notes (optional) |
| src/pages/FlightTracker.tsx | 1 | 2 | None |
| src/pages/Glossary.tsx | 2 | 0 | None |
| src/pages/Graffiti.tsx | 1 | 1 | Message (max 500 chars) |
| src/pages/Gym.tsx | 5 | 1 | None |
| src/pages/Halloween.tsx | 3 | 0 | None |
| src/pages/Leaderboards.tsx | 4 | 2 | None |
| src/pages/LiveFeeds.tsx | 5 | 2 | None |
| src/pages/LoanReminders.tsx | 1 | 0 | None |
| src/pages/LossMarketplace.tsx | 4 | 1 | None |
| src/pages/Losses.tsx | 4 | 0 | None |
| src/pages/Markets.tsx | 3 | 0 | None |
| src/pages/NotificationPrefs.tsx | 0 | 0 | None |
| src/pages/Notifications.tsx | 0 | 0 | None |
| src/pages/OcPlanner.tsx | 4 | 0 | Notes (optional) |
| src/pages/OperatorDashboard.tsx | 0 | 0 | None |
| src/pages/Overview.tsx | 0 | 0 | None |
| src/pages/PayoutCalculator.tsx | 7 | 0 | None |
| src/pages/Payouts.tsx | 5 | 0 | None |
| src/pages/PiMortgages.tsx | 7 | 2 | {notes}; {reference}; {reason} |
| src/pages/Planner.tsx | 2 | 0 | None |
| src/pages/PlayerIntel.tsx | 1 | 0 | None |
| src/pages/Properties.tsx | 5 | 0 | None |
| src/pages/PublicApi.tsx | 0 | 0 | None |
| src/pages/Racing.tsx | 4 | 0 | None |
| src/pages/Recruitment.tsx | 6 | 0 | None |
| src/pages/Reports.tsx | 0 | 0 | Report title; {reportJson} |
| src/pages/RetentionTrends.tsx | 3 | 1 | Notes (optional) |
| src/pages/ReviveMarketplace.tsx | 4 | 0 | Notes (optional) |
| src/pages/ReviveTracker.tsx | 5 | 0 | Notes (optional) |
| src/pages/RoiCalculator.tsx | 3 | 1 | None |
| src/pages/Settings.tsx | 0 | 4 | None |
| src/pages/SettlementQueue.tsx | 2 | 0 | None |
| src/pages/SharedReport.tsx | 0 | 0 | None |
| src/pages/SpyReports.tsx | 0 | 0 | ID, Name, STR, DEF, SPD, DEX |
| src/pages/StatGrowth.tsx | 0 | 0 | None |
| src/pages/StatIntelligence.tsx | 0 | 0 | None |
| src/pages/StatsCatalog.tsx | 2 | 0 | None |
| src/pages/Stocks.tsx | 3 | 0 | None |
| src/pages/TargetPools.tsx | 2 | 0 | Description (optional) |
| src/pages/Targets.tsx | 7 | 4 | None |
| src/pages/TornStats.tsx | 0 | 0 | None |
| src/pages/Travel.tsx | 0 | 0 | None |
| src/pages/TravelOptimizer.tsx | 0 | 0 | None |
| src/pages/WarAnalyzer.tsx | 0 | 0 | None |
| src/pages/WarHits.tsx | 4 | 0 | None |
| src/pages/WarRoom.tsx | 2 | 0 | War name |
| src/pages/WatchedFactions.tsx | 4 | 0 | None |
| src/components/ApiParameterField.tsx | 4 | 1 | {value} |
| src/components/ChoiceInput.tsx | 1 | 0 | {label} |
| src/components/ConnectedInsights.tsx | 0 | 0 | None |
| src/components/DataEntry.tsx | 2 | 0 | None |
| src/components/ErrorBoundary.tsx | 0 | 0 | None |
| src/components/HistoryExplorer.tsx | 2 | 0 | None |
| src/components/KeyDisclosure.tsx | 0 | 0 | None |
| src/components/LevellingCatalogue.tsx | 4 | 2 | None |
| src/components/MultiChoiceEntry.tsx | 1 | 0 | None |
| src/components/MyTorn.tsx | 3 | 2 | None |
| src/components/SavedPresets.tsx | 1 | 0 | {name} |
| src/components/SelectEntry.tsx | 1 | 0 | {placeholder} |
| src/components/SpatialShell.tsx | 0 | 0 | None |
| src/components/TornDataShortcut.tsx | 0 | 0 | None |
| src/components/TornDataView.tsx | 0 | 0 | None |
| src/components/TravelProfitTool.tsx | 12 | 1 | None |

Verification: 163 automated tests and the production build pass. Coverage checks catalogue identity boundaries, item categories, numeric bounds/step, preservation of exact values, empty-data rendering, multi-target retention, and blank production forms. Interactive browser and legitimate-key testing were not performed.
