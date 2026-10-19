-- Torn Command Center - Phase 30 missing FK indexes (performance hardening)

create index if not exists idx_payout_policies_user on public.payout_policies(user_id);
create index if not exists idx_payout_runs_user on public.payout_runs(user_id);
create index if not exists idx_target_claims_user on public.target_claims(user_id);
create index if not exists idx_war_hits_user on public.war_hits(user_id);
create index if not exists idx_dibs_war on public.dibs(war_id);
create index if not exists idx_notification_events_rule on public.notification_events(rule_id);
create index if not exists idx_discord_webhooks_alliance on public.discord_webhooks(alliance_id);
create index if not exists idx_faction_ledger_entries_related_request on public.faction_ledger_entries(related_request_id);
