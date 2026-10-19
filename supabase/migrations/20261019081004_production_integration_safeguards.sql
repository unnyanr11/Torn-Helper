-- Unconfigured adapters must not collect browser-visible credentials or claim connected status.
-- Existing rows remain owner-deletable; secret values remain accessible only to server roles.
revoke all on public.integration_connections from anon,authenticated;
grant select(id,user_id,provider,status,connected_at,disconnected_at),delete on public.integration_connections to authenticated;
grant all on public.integration_connections to service_role;
revoke all on public.discord_webhooks from anon,authenticated;
grant select(id,user_id,alliance_id,label,enabled,created_at),delete on public.discord_webhooks to authenticated;
grant all on public.discord_webhooks to service_role;
-- No delivery implementation exists for these preferences. Keep records readable/removable,
-- while preventing clients from enabling nonfunctional channels.
revoke insert,update on public.notification_preferences from anon,authenticated;
