# Source inventory

Static inventory of every page module. Table references describe implemented queries, not acceptance-test completion. Most existing feature modules remain partial under the full requirements.

| Module | Referenced tables | Invoked functions |
|---|---|---|
| Activity | activity_observations | None |
| AdminCostDashboard | api_usage | None |
| AiSettings | encrypted_credentials | remove-ai-key |
| AiWarAnalyzer | ai_consents, encrypted_credentials | analyze-war-ai |
| Alerts | alert_rules, notification_events | None |
| AllianceSharing | alliance_sharing_grants | None |
| Alliances | alliance_announcements, alliance_invitations, alliance_members, alliances | None |
| ApiUsage | Calculation / static UI | None |
| ArmoryHistory | faction_armory_events, faction_loans | None |
| Assistant | assistant_logs | None |
| Bounties | bounties | None |
| ChainQueue | chain_target_queue | None |
| Community | community_posts | None |
| Company | company_snapshots | None |
| ComparePlayers | estimates, player_observations, target_list_entries | None |
| CompetitorMatrix | Calculation / static UI | None |
| CrimeTracker | crime_logs | None |
| CustomStats | custom_columns, custom_entries | None |
| DailyDigest | chain_target_queue, daily_digests, faction_chain_state, faction_loans, travel_profit_scenarios | None |
| Dibs | dibs | None |
| Discord | discord_webhooks | None |
| Estimates | estimate_settings, estimates | None |
| FactionFinance | faction_ledger_entries, faction_money_requests, profiles | None |
| FactionOps | faction_armory, faction_chain_state, faction_members, faction_territory | None |
| FactionUpgrades | faction_upgrade_simulations | None |
| FlightTracker | flight_logs | None |
| Glossary | Calculation / static UI | None |
| Graffiti | graffiti-images, graffiti_posts, graffiti_reactions | None |
| Gym | gym_sessions | None |
| Halloween | halloween_candy_log | None |
| Leaderboards | gym_sessions, payout_lines, racing_records | None |
| LiveFeeds | live_feed_cache | None |
| LoanReminders | alert_rules, faction_loans | None |
| LossMarketplace | loss_attack_evidence, loss_claims, loss_contracts, loss_disputes, loss_settlement_entries | None |
| Losses | loss_claims, loss_contracts | None |
| Markets | watchlists | None |
| NotificationPrefs | notification_preferences | None |
| Notifications | notifications | None |
| OcPlanner | oc_plans, oc_slots | None |
| OperatorDashboard | loss_disputes, loss_funding_records, loss_settlement_entries, profiles | None |
| Overview | Calculation / static UI | None |
| PayoutCalculator | payout_audit, payout_lines, payout_policies, payout_runs, wars | None |
| Payouts | payout_lines, payout_policies, payout_runs, wars | None |
| PiMortgages | Calculation / static UI | None |
| Placeholder | Calculation / static UI | None |
| Planner | goals | None |
| PlayerIntel | Calculation / static UI | player-intel |
| Properties | property_records | None |
| PublicApi | Calculation / static UI | None |
| Racing | racing_records | None |
| Recruitment | recruitment_candidates | None |
| Reports | report_share_grants, report_snapshots | None |
| RetentionTrends | faction_membership_events | None |
| ReviveMarketplace | revive_claims, revive_contracts | None |
| ReviveTracker | revive_logs | None |
| RoiCalculator | Calculation / static UI | None |
| Settings | linked_torn_accounts, profiles | account-data, link-torn-key, remove-ai-key |
| SettlementQueue | loss_disputes, loss_settlement_entries | None |
| SharedReport | Calculation / static UI | shared-report |
| SpyReports | spy_reports | None |
| StatGrowth | custom_columns, custom_entries, gym_sessions | None |
| StatIntelligence | estimates | None |
| StatsCatalog | Calculation / static UI | None |
| Stocks | stock_holdings | None |
| TargetPools | target_pools | None |
| Targets | target_list_entries, target_lists | None |
| TornStats | integration_connections, spy_import_jobs | None |
| Travel | travel_observations | None |
| TravelOptimizer | travel_profit_scenarios | None |
| WarAnalyzer | wars | None |
| WarHits | war_hits, wars | None |
| WarRoom | target_claims, wars | None |
| WatchedFactions | watched_factions | None |
