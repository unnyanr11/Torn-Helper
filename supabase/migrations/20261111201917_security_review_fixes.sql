-- Narrow service-only quotas. Rejected local requests never consume the shared allowance.
create or replace function private.consume_torn_login_budget(ip_fingerprint text,key_fingerprint text) returns boolean language plpgsql security definer set search_path='' as $$
declare minute timestamptz:=date_trunc('minute',now()); item record; n integer;
begin
 if ip_fingerprint is null or key_fingerprint is null or ip_fingerprint !~ '^[a-f0-9]{64}$' or key_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'Invalid request fingerprint';end if;
 perform pg_advisory_xact_lock(920320,1);
 delete from private.torn_login_limits where bucket<minute-interval '1 hour';
 for item in select * from (values('ip',ip_fingerprint,30),('key',key_fingerprint,5),('global','all',200)) as limits(scope,fingerprint,ceiling) loop
  select attempts into n from private.torn_login_limits l where l.scope=item.scope and l.fingerprint=item.fingerprint and l.bucket=minute;
  if coalesce(n,0)>=item.ceiling then return false;end if;
 end loop;
 insert into private.torn_login_limits(scope,fingerprint,bucket,attempts) values('ip',ip_fingerprint,minute,1),('key',key_fingerprint,minute,1),('global','all',minute,1)
 on conflict(scope,fingerprint,bucket) do update set attempts=private.torn_login_limits.attempts+1;
 return true;
end $$;
create or replace function private.consume_torn_data_budget(owner_id uuid,cost integer) returns boolean language plpgsql security definer set search_path='' as $$
declare minute timestamptz:=date_trunc('minute',now()); item record; n integer;
begin
 if owner_id is null or cost is null or cost not between 1 and 5 then raise exception 'Invalid budget request';end if;
 perform pg_advisory_xact_lock(920320,2);
 delete from private.torn_data_budgets where bucket<minute-interval '1 day';
 for item in select * from (values('user',owner_id::text,60),('global','all',600)) as limits(scope,subject,ceiling) loop
  select attempts into n from private.torn_data_budgets b where b.scope=item.scope and b.subject=item.subject and b.bucket=minute;
  if coalesce(n,0)+cost>item.ceiling then return false;end if;
 end loop;
 insert into private.torn_data_budgets(scope,subject,bucket,attempts) values('user',owner_id::text,minute,cost),('global','all',minute,cost)
 on conflict(scope,subject,bucket) do update set attempts=private.torn_data_budgets.attempts+cost;
 return true;
end $$;
create table private.torn_request_slots(token uuid primary key default gen_random_uuid(),owner_id uuid not null,expires_at timestamptz not null);
create index torn_request_slots_owner on private.torn_request_slots(owner_id,expires_at);
alter table private.torn_request_slots enable row level security;
create policy service_only on private.torn_request_slots to service_role using(true) with check(true);
revoke all on private.torn_request_slots from public,anon,authenticated;
grant all on private.torn_request_slots to service_role;
create function private.torn_request_slot(owner_id uuid,release_token uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if owner_id is null then raise exception 'Owner required';end if;
 perform pg_advisory_xact_lock(920321,hashtext(owner_id::text));
 if release_token is not null then delete from private.torn_request_slots s where s.owner_id=torn_request_slot.owner_id and s.token=release_token;return null;end if;
 delete from private.torn_request_slots where expires_at<=clock_timestamp();
 if (select count(*) from private.torn_request_slots s where s.owner_id=torn_request_slot.owner_id)>=6 then return null;end if;
 insert into private.torn_request_slots(owner_id,expires_at) values(owner_id,clock_timestamp()+interval '30 seconds') returning token into result;
 return result;
end $$;
create function public.torn_request_slot(owner_id uuid,release_token uuid default null) returns uuid language sql security invoker set search_path='' as $$select private.torn_request_slot(owner_id,release_token)$$;
revoke all on function private.torn_request_slot(uuid,uuid),public.torn_request_slot(uuid,uuid) from public,anon,authenticated;
grant execute on function private.torn_request_slot(uuid,uuid),public.torn_request_slot(uuid,uuid) to service_role;

-- Count requests atomically in a service-only ledger, never editable user history.
revoke insert,update,delete on public.ai_analysis_requests from anon,authenticated;
create function private.reserve_ai_analysis(owner_id uuid,provider_name text,model_name text,war uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare minute timestamptz:=date_trunc('minute',now());n integer;result uuid;item record;
begin
 if owner_id is null or provider_name not in ('openai','gemini') or model_name is null or length(model_name)>200 then raise exception 'Invalid analysis request';end if;
 if war is not null and not exists(select 1 from public.wars w where w.id=war and w.user_id=owner_id) then raise exception 'War not found';end if;
 perform pg_advisory_xact_lock(920320,3);
 delete from private.torn_data_budgets where bucket<minute-interval '1 day';
 for item in select * from (values('ai-user',owner_id::text,3),('ai-global','all',60)) as limits(scope,subject,ceiling) loop
  select attempts into n from private.torn_data_budgets b where b.scope=item.scope and b.subject=item.subject and b.bucket=minute;
  if coalesce(n,0)>=item.ceiling then return null;end if;
 end loop;
 insert into private.torn_data_budgets(scope,subject,bucket,attempts) values('ai-user',owner_id::text,minute,1),('ai-global','all',minute,1)
 on conflict(scope,subject,bucket) do update set attempts=private.torn_data_budgets.attempts+1;
 insert into public.ai_analysis_requests(user_id,provider,model,war_id,status) values(owner_id,provider_name,model_name,war,'pending') returning id into result;
 return result;
end $$;
create function public.reserve_ai_analysis(owner_id uuid,provider_name text,model_name text,war uuid default null) returns uuid language sql security invoker set search_path='' as $$select private.reserve_ai_analysis(owner_id,provider_name,model_name,war)$$;
revoke all on function private.reserve_ai_analysis(uuid,text,text,uuid),public.reserve_ai_analysis(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function private.reserve_ai_analysis(uuid,text,text,uuid),public.reserve_ai_analysis(uuid,text,text,uuid) to service_role;

-- Validate future profile changes. Legacy malformed zones are handled safely by the worker.
create function private.validate_profile_timezone() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'Choose a valid IANA timezone';end if;
 return new;
end $$;
revoke all on function private.validate_profile_timezone() from public,anon,authenticated;
create trigger validate_profile_timezone before insert or update of timezone on public.profiles for each row execute function private.validate_profile_timezone();
alter table public.alert_rules add column last_evaluated_at timestamptz;
create index alert_rules_evaluation_queue on public.alert_rules(last_evaluated_at nulls first,id) where enabled;
revoke update on public.alert_rules from anon,authenticated;
grant update(name,condition_type,threshold,enabled,quiet_hours_start,quiet_hours_end,due_soon_days) on public.alert_rules to authenticated;
create function private.guard_alert_rule() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.due_soon_days is not null and new.due_soon_days not between 0 and 365 then raise exception 'Choose a due window from 0 to 365 days';end if;
 if new.enabled and (tg_op='INSERT' or old.enabled is not true) then
  perform 1 from public.profiles where id=new.user_id for update;
  if (select count(*) from public.alert_rules r where r.user_id=new.user_id and r.enabled and r.id<>new.id)>=25 then raise exception 'At most 25 enabled alert rules are allowed';end if;
 end if;
 if tg_op='INSERT' then new.last_evaluated_at:=null;end if;
 return new;
end $$;
revoke all on function private.guard_alert_rule() from public,anon,authenticated;
create trigger guard_alert_rule before insert or update on public.alert_rules for each row execute function private.guard_alert_rule();

-- Private helper reads only the current user's role and avoids recursive RLS.
create function private.alliance_role(group_id uuid) returns text language sql stable security definer set search_path='' as $$
 select m.role from public.alliance_members m where m.alliance_id=group_id and m.user_id=(select auth.uid()) and auth.uid() is not null
$$;
revoke all on function private.alliance_role(uuid) from public,anon,authenticated;
grant execute on function private.alliance_role(uuid) to authenticated;
do $$declare r record;begin
 for r in select tablename,policyname from pg_policies where schemaname='public' and tablename in ('alliances','alliance_members','alliance_invitations','alliance_announcements','graffiti_posts') loop
 execute format('drop policy %I on public.%I',r.policyname,r.tablename);end loop;
end $$;
create policy alliance_read on public.alliances for select to authenticated using(private.alliance_role(alliances.id) is not null);
revoke insert on public.alliances from anon,authenticated;
create policy alliance_member_read on public.alliance_members for select to authenticated using(private.alliance_role(alliance_members.alliance_id) is not null);
create policy alliance_member_add on public.alliance_members for insert to authenticated with check(private.alliance_role(alliance_members.alliance_id)='leader' or (private.alliance_role(alliance_members.alliance_id)='officer' and role='member'));
create policy alliance_member_edit on public.alliance_members for update to authenticated using(private.alliance_role(alliance_members.alliance_id)='leader') with check(private.alliance_role(alliance_members.alliance_id)='leader');
create policy alliance_member_remove on public.alliance_members for delete to authenticated using(user_id=(select auth.uid()) or private.alliance_role(alliance_members.alliance_id)='leader');
create policy invitation_read on public.alliance_invitations for select to authenticated using(inviter_user_id=(select auth.uid()) or invitee_user_id=(select auth.uid()) or private.alliance_role(alliance_invitations.alliance_id) is not null);
create policy invitation_add on public.alliance_invitations for insert to authenticated with check(inviter_user_id=(select auth.uid()) and private.alliance_role(alliance_invitations.alliance_id) in ('officer','leader') and status='pending');
create policy invitation_edit on public.alliance_invitations for update to authenticated using(invitee_user_id=(select auth.uid()) or inviter_user_id=(select auth.uid())) with check(invitee_user_id=(select auth.uid()) or inviter_user_id=(select auth.uid()));
revoke update on public.alliance_invitations from anon,authenticated;
grant update(status) on public.alliance_invitations to authenticated;
create policy announcement_read on public.alliance_announcements for select to authenticated using(private.alliance_role(alliance_announcements.alliance_id) is not null);
create policy announcement_add on public.alliance_announcements for insert to authenticated with check(author_user_id=(select auth.uid()) and private.alliance_role(alliance_announcements.alliance_id) in ('officer','leader'));
create policy announcement_remove on public.alliance_announcements for delete to authenticated using(author_user_id=(select auth.uid()) or private.alliance_role(alliance_announcements.alliance_id)='leader');
create policy graffiti_read on public.graffiti_posts for select to authenticated using(not hidden and private.alliance_role(graffiti_posts.alliance_id) is not null);
create policy graffiti_add on public.graffiti_posts for insert to authenticated with check(author_user_id=(select auth.uid()) and private.alliance_role(graffiti_posts.alliance_id) is not null);
create policy graffiti_moderate on public.graffiti_posts for update to authenticated using(private.alliance_role(graffiti_posts.alliance_id) in ('officer','leader')) with check(private.alliance_role(graffiti_posts.alliance_id) in ('officer','leader'));
create policy graffiti_remove on public.graffiti_posts for delete to authenticated using(author_user_id=(select auth.uid()) or private.alliance_role(graffiti_posts.alliance_id) in ('officer','leader'));
create function private.create_alliance(alliance_name text,alliance_tag text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 if alliance_name is null or length(btrim(alliance_name)) not between 1 and 100 or length(coalesce(alliance_tag,''))>20 then raise exception 'Enter a name up to 100 characters and tag up to 20';end if;
 insert into public.alliances(name,tag,created_by) values(btrim(alliance_name),nullif(btrim(alliance_tag),''),auth.uid()) returning id into result;
 insert into public.alliance_members(alliance_id,user_id,role) values(result,auth.uid(),'leader');
 return result;
end $$;
create function public.create_alliance(alliance_name text,alliance_tag text default null) returns uuid language sql security invoker set search_path='' as $$select private.create_alliance(alliance_name,alliance_tag)$$;
revoke all on function private.create_alliance(text,text),public.create_alliance(text,text) from public,anon,authenticated;
grant execute on function private.create_alliance(text,text),public.create_alliance(text,text) to authenticated;
