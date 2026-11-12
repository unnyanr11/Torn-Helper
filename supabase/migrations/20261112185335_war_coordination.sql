alter table public.war_target_lists add column priorities jsonb not null default '{}', add column war_start bigint, add column war_end bigint;
create table private.war_memberships(user_id uuid primary key references public.profiles(id) on delete cascade,faction_id bigint not null,torn_id bigint not null,verified_until timestamptz not null);
alter table private.war_memberships enable row level security;
revoke all on private.war_memberships from public,anon,authenticated;grant all on private.war_memberships to service_role;
create function private.can_read_war_faction(faction bigint) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from private.war_memberships m join public.linked_torn_accounts a on a.user_id=m.user_id and a.torn_id=m.torn_id where m.user_id=auth.uid() and m.faction_id=faction and m.verified_until>now() and a.revoked_at is null)
$$;
revoke all on function private.can_read_war_faction(bigint) from public,anon;grant execute on function private.can_read_war_faction(bigint) to authenticated;
create table public.war_target_claims(faction_id bigint not null,war_key text not null,target_id bigint not null,user_id uuid not null references public.profiles(id) on delete cascade,claimant_torn_id bigint not null,claimant_name text not null,expires_at timestamptz not null,claim_id uuid not null default gen_random_uuid(),claimed_at timestamptz not null default now(),attacks_goal integer not null default 1 check(attacks_goal between 1 and 100),attacks_done integer not null default 0,primary key(faction_id,war_key,target_id));
create index war_claims_owner on public.war_target_claims(user_id);
alter table public.war_target_claims enable row level security;
revoke all on public.war_target_claims from public,anon,authenticated;grant select on public.war_target_claims to authenticated;grant all on public.war_target_claims to service_role;
create policy war_faction_claims_read on public.war_target_claims for select to authenticated using(private.can_read_war_faction(faction_id));
alter publication supabase_realtime add table public.war_target_claims;
create table public.war_alert_preferences(user_id uuid primary key references public.profiles(id) on delete cascade,lead_seconds integer not null default 20 check(lead_seconds between 5 and 120),sound text not null default 'off' check(sound in ('off','soft','double')),volume numeric not null default 0.5 check(volume between 0 and 1),desktop boolean not null default true);
alter table public.war_alert_preferences enable row level security;
revoke all on public.war_alert_preferences from public,anon,authenticated;grant select on public.war_alert_preferences to authenticated;grant all on public.war_alert_preferences to service_role;
create policy war_alert_owner on public.war_alert_preferences for select to authenticated using(user_id=(select auth.uid()));
create table public.war_events(id bigint generated always as identity primary key,user_id uuid not null references public.profiles(id) on delete cascade,faction_id bigint not null,war_key text not null,actor_torn_id bigint not null,kind text not null,details jsonb not null,created_at timestamptz not null default now());
create index war_events_owner_war on public.war_events(user_id,war_key,created_at);
create index war_events_faction_war on public.war_events(faction_id,war_key,created_at);
alter table public.war_events enable row level security;
revoke all on public.war_events from public,anon,authenticated;grant select on public.war_events to authenticated;grant all on public.war_events to service_role;grant usage,select on sequence public.war_events_id_seq to service_role;
create policy war_events_owner on public.war_events for select to authenticated using(user_id=(select auth.uid()));
create table public.war_reports(user_id uuid not null references public.profiles(id) on delete cascade,war_key text not null,faction_id bigint not null,war_start bigint not null,war_end bigint,enemy_faction_id bigint not null,attacks jsonb not null default '[]',next_parameters jsonb,coverage text not null default 'not_loaded',updated_at timestamptz not null default now(),primary key(user_id,war_key));
alter table public.war_reports enable row level security;
revoke all on public.war_reports from public,anon,authenticated;grant select on public.war_reports to authenticated;grant all on public.war_reports to service_role;
create policy war_reports_owner on public.war_reports for select to authenticated using(user_id=(select auth.uid()));
-- Audit and archive assignment changes in the same transaction as the write.
create function private.audit_war_list() returns trigger language plpgsql security invoker set search_path='' as $$
declare previous jsonb; target jsonb;
begin
 if TG_OP='INSERT' or new.war_key is distinct from old.war_key or new.target_ids is distinct from old.target_ids or new.priorities is distinct from old.priorities then
  previous:=case when TG_OP='INSERT' then '[]'::jsonb else to_jsonb(old.target_ids) end;
  insert into public.war_events(user_id,faction_id,war_key,actor_torn_id,kind,details) values(new.user_id,new.faction_id,new.war_key,new.updated_by,'assignment',jsonb_build_object('before',previous,'after',new.target_ids,'priorities',new.priorities));
  delete from public.war_target_claims c where c.user_id=new.user_id and (c.war_key<>new.war_key or not(c.target_id=any(new.target_ids)));
 end if;
 for target in select value from jsonb_array_elements(new.targets) loop
  if TG_OP='INSERT' or new.war_key is distinct from old.war_key or not exists(select 1 from jsonb_array_elements(old.targets) t where t->>'id'=target->>'id' and t->>'state'=target->>'state') then
   insert into public.war_events(user_id,faction_id,war_key,actor_torn_id,kind,details) values(new.user_id,new.faction_id,new.war_key,new.updated_by,'status',jsonb_build_object('target_id',target->'id','name',target->'name','state',target->'state'));
  end if;
 end loop;
 if new.war_start is not null then
  insert into public.war_reports(user_id,war_key,faction_id,war_start,war_end,enemy_faction_id) values(new.user_id,new.war_key,new.faction_id,new.war_start,new.war_end,new.enemy_faction_id)
  on conflict(user_id,war_key) do update set war_end=coalesce(excluded.war_end,public.war_reports.war_end);
 end if;
 if not new.active then delete from public.war_target_claims where user_id=new.user_id;end if;
 return new;
end $$;
revoke all on function private.audit_war_list() from public,anon,authenticated;
create trigger audit_war_list after insert or update on public.war_target_lists for each row execute function private.audit_war_list();
-- Atomic short claim lease. No browser role can invoke these service-only RPCs.
create function public.take_war_target(owner_id uuid,target bigint,attack_goal integer default 1) returns jsonb language plpgsql security invoker set search_path='' as $$
declare w public.war_target_lists; a public.linked_torn_accounts; result public.war_target_claims;
begin
 if attack_goal is null or attack_goal<1 or attack_goal>100 then raise exception 'Choose between 1 and 100 attacks.';end if;
 select * into w from public.war_target_lists where user_id=owner_id and active and verified_until>now() and target=any(target_ids);
 if not found then raise exception 'Refresh your assigned targets first.';end if;
 select * into a from public.linked_torn_accounts where user_id=owner_id and revoked_at is null;
 if not found or not exists(select 1 from private.war_memberships m where m.user_id=owner_id and m.faction_id=w.faction_id and m.torn_id=a.torn_id and m.verified_until>now()) then raise exception 'Refresh faction verification first.';end if;
 insert into public.war_target_claims(faction_id,war_key,target_id,user_id,claimant_torn_id,claimant_name,expires_at,attacks_goal) values(w.faction_id,w.war_key,target,owner_id,a.torn_id,a.torn_name,now()+interval '10 minutes',attack_goal)
 on conflict(faction_id,war_key,target_id) do update set user_id=excluded.user_id,claimant_torn_id=excluded.claimant_torn_id,claimant_name=excluded.claimant_name,expires_at=excluded.expires_at,attacks_goal=excluded.attacks_goal,attacks_done=0,claimed_at=now(),claim_id=gen_random_uuid() where public.war_target_claims.expires_at<=now() or public.war_target_claims.user_id=owner_id returning * into result;
 if not found then raise exception 'Another member already claimed this target.';end if;
 insert into public.war_events(user_id,faction_id,war_key,actor_torn_id,kind,details) values(owner_id,w.faction_id,w.war_key,a.torn_id,'claim',jsonb_build_object('target_id',target,'expires_at',result.expires_at));
 return to_jsonb(result);
end $$;
revoke all on function public.take_war_target(uuid,bigint,integer) from public,anon,authenticated;grant execute on function public.take_war_target(uuid,bigint,integer) to service_role;
create table private.war_prealert_checks(user_id uuid not null references public.profiles(id) on delete cascade,check_key text not null,created_at timestamptz not null default now(),primary key(user_id,check_key));
alter table private.war_prealert_checks enable row level security;revoke all on private.war_prealert_checks from public,anon,authenticated;grant all on private.war_prealert_checks to service_role;
create function public.begin_war_prealert(owner_id uuid,check_id text) returns boolean language plpgsql security invoker set search_path='' as $$
declare count_rows integer;
begin
 delete from private.war_prealert_checks where created_at<now()-interval '1 day';
 insert into private.war_prealert_checks(user_id,check_key) values(owner_id,check_id) on conflict do nothing;
 get diagnostics count_rows=row_count;return count_rows=1;
end $$;
revoke all on function public.begin_war_prealert(uuid,text) from public,anon,authenticated;grant execute on function public.begin_war_prealert(uuid,text) to service_role;

create table private.war_claim_attacks(claim_id uuid not null,attack_id text not null,primary key(claim_id,attack_id));
alter table private.war_claim_attacks enable row level security;revoke all on private.war_claim_attacks from public,anon,authenticated;grant all on private.war_claim_attacks to service_role;
create function public.record_war_claim_attacks(owner_id uuid,records jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare c public.war_target_claims; a jsonb; added integer; completed integer:=0;
begin
 if jsonb_typeof(records)<>'array' or jsonb_array_length(records)>200 then raise exception 'Invalid attack page.';end if;
 for c in select * from public.war_target_claims where user_id=owner_id and expires_at>now() for update loop
  for a in select value from jsonb_array_elements(records) loop
   if (a->>'attacker')::bigint=c.claimant_torn_id and (a->>'defender')::bigint=c.target_id and (a->>'started')::numeric>=extract(epoch from c.claimed_at) and (a->>'ended')::numeric>=extract(epoch from c.claimed_at) and (a->>'ended')::numeric<=extract(epoch from now()) and a->>'id' ~ '^[0-9]+$' then
    insert into private.war_claim_attacks(claim_id,attack_id) values(c.claim_id,a->>'id') on conflict do nothing;get diagnostics added=row_count;
    if added=1 then c.attacks_done:=c.attacks_done+1;end if;
   end if;
  end loop;
  if c.attacks_done>=c.attacks_goal then
   delete from public.war_target_claims where claim_id=c.claim_id;
   insert into public.war_events(user_id,faction_id,war_key,actor_torn_id,kind,details) values(owner_id,c.faction_id,c.war_key,c.claimant_torn_id,'claim_completed',jsonb_build_object('target_id',c.target_id,'attacks',c.attacks_done,'goal',c.attacks_goal));completed:=completed+1;
  else
   update public.war_target_claims set attacks_done=c.attacks_done,expires_at=case when attacks_done<c.attacks_done then least(now()+interval '10 minutes',claimed_at+interval '1 hour') else expires_at end where claim_id=c.claim_id;
  end if;
 end loop;
 return completed;
end $$;
revoke all on function public.record_war_claim_attacks(uuid,jsonb) from public,anon,authenticated;grant execute on function public.record_war_claim_attacks(uuid,jsonb) to service_role;
create table private.war_claim_scans(user_id uuid primary key references public.profiles(id) on delete cascade,claim_ids jsonb not null,next_parameters jsonb);
alter table private.war_claim_scans enable row level security;revoke all on private.war_claim_scans from public,anon,authenticated;grant all on private.war_claim_scans to service_role;

create function public.war_claim_scan(owner_id uuid,ids jsonb,next_value jsonb default null,save_value boolean default false) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if save_value then insert into private.war_claim_scans(user_id,claim_ids,next_parameters) values(owner_id,ids,next_value) on conflict(user_id) do update set claim_ids=excluded.claim_ids,next_parameters=excluded.next_parameters;return next_value;end if;
 select next_parameters into result from private.war_claim_scans where user_id=owner_id and claim_ids=ids;return result;
end $$;
revoke all on function public.war_claim_scan(uuid,jsonb,jsonb,boolean) from public,anon,authenticated;grant execute on function public.war_claim_scan(uuid,jsonb,jsonb,boolean) to service_role;
create function public.verify_war_membership(owner_id uuid,faction bigint,identity bigint) returns void language sql security invoker set search_path='' as $$
 insert into private.war_memberships(user_id,faction_id,torn_id,verified_until) values(owner_id,faction,identity,now()+interval '2 minutes') on conflict(user_id) do update set faction_id=excluded.faction_id,torn_id=excluded.torn_id,verified_until=excluded.verified_until
$$;
revoke all on function public.verify_war_membership(uuid,bigint,bigint) from public,anon,authenticated;grant execute on function public.verify_war_membership(uuid,bigint,bigint) to service_role;
grant usage on schema private to authenticated,service_role;
