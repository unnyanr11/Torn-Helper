-- Only four voluntarily shared battle stats. Trusted gateway cache proves identity,
-- current faction and leader IDs; editable roster/position strings grant no access.
create table private.faction_battle_shares (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 torn_id bigint not null check(torn_id>0),
 faction_id bigint not null check(faction_id>0),
 consented_at timestamptz not null default now()
);
create table private.faction_battle_snapshots (
 user_id uuid not null references private.faction_battle_shares(user_id) on delete cascade,
 faction_id bigint not null check(faction_id>0),
 observed_at timestamptz not null,
 strength numeric not null check(strength>=0 and strength<1e30),
 defense numeric not null check(defense>=0 and defense<1e30),
 speed numeric not null check(speed>=0 and speed<1e30),
 dexterity numeric not null check(dexterity>=0 and dexterity<1e30),
 primary key(user_id,observed_at)
);
alter table private.faction_battle_shares enable row level security;
alter table private.faction_battle_snapshots enable row level security;
create policy battle_share_owner on private.faction_battle_shares for select to authenticated using(user_id=(select auth.uid()));
create policy battle_snapshot_owner on private.faction_battle_snapshots for select to authenticated using(user_id=(select auth.uid()));
revoke all on private.faction_battle_shares,private.faction_battle_snapshots from public,anon,authenticated;
grant all on private.faction_battle_shares,private.faction_battle_snapshots to service_role;

create function private.faction_battle_snapshot_json(b private.faction_battle_snapshots) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('observed_at',b.observed_at,'strength',b.strength::text,'defense',b.defense::text,'speed',b.speed::text,'dexterity',b.dexterity::text)
$$;
revoke all on function private.faction_battle_snapshot_json(private.faction_battle_snapshots) from public,anon,authenticated;

create function private.faction_battle_proof(endpoint text) returns public.torn_data_cache
language plpgsql stable security definer set search_path='' as $$
declare result public.torn_data_cache;
begin
 if auth.uid() is null then raise exception 'Sign in with your Torn account.'; end if;
 if not exists(select 1 from public.linked_torn_accounts where user_id=auth.uid() and revoked_at is null) then raise exception 'Link your Torn identity in Settings.'; end if;
 select * into result from public.torn_data_cache c where c.user_id=auth.uid() and c.endpoint_id=endpoint and c.parameters='{}'::jsonb order by c.fetched_at desc limit 1;
 if not found or result.fetched_at<now()-interval '5 minutes' or result.fetched_at>now() then raise exception 'Refresh faction verification first. Verification lasts five minutes.'; end if;
 return result;
end $$;

create function private.set_faction_battle_sharing(enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); identity bigint; faction bigint; membership public.torn_data_cache; stats public.torn_data_cache; values_json jsonb; k text; previous_faction bigint;
begin
 if owner is null then raise exception 'Sign in with your Torn account.'; end if;
 perform 1 from public.profiles where id=owner for update;
 if enabled is not true then
  delete from private.faction_battle_shares where user_id=owner;
  return jsonb_build_object('enabled',false);
 end if;
 if exists(select 1 from public.profiles where id=owner and tracking_paused) then raise exception 'Resume tracking in Settings before sharing stats.'; end if;
 select torn_id into identity from public.linked_torn_accounts where user_id=owner and revoked_at is null;
 if identity is null then raise exception 'Link your Torn identity in Settings.'; end if;
 membership:=private.faction_battle_proof('v2-user-faction');
 faction:=(membership.payload#>>'{faction,id}')::bigint;
 if faction is null or faction<=0 then raise exception 'You must belong to a Torn faction.'; end if;
 stats:=private.faction_battle_proof('v2-user-battlestats');
 values_json:=stats.payload->'battlestats';
 foreach k in array array['strength','defense','speed','dexterity'] loop
  if jsonb_typeof(values_json#>array[k,'value']) is distinct from 'number' or (values_json#>>array[k,'value'])::numeric<0 or (values_json#>>array[k,'value'])::numeric>=1e30 then raise exception 'Torn did not return all four numeric battle stats.'; end if;
 end loop;
 select faction_id into previous_faction from private.faction_battle_shares where user_id=owner;
 -- A new faction requires this explicit opt-in again and starts a separate history.
 if previous_faction is distinct from faction then delete from private.faction_battle_shares where user_id=owner; end if;
 insert into private.faction_battle_shares(user_id,torn_id,faction_id) values(owner,identity,faction)
 on conflict(user_id) do update set torn_id=excluded.torn_id;
 insert into private.faction_battle_snapshots(user_id,faction_id,observed_at,strength,defense,speed,dexterity)
 values(owner,faction,stats.fetched_at,(values_json#>>'{strength,value}')::numeric,(values_json#>>'{defense,value}')::numeric,(values_json#>>'{speed,value}')::numeric,(values_json#>>'{dexterity,value}')::numeric)
 on conflict(user_id,observed_at) do nothing;
 return jsonb_build_object('enabled',true,'faction_id',faction,'observed_at',stats.fetched_at);
end $$;

create function private.my_faction_battle_sharing() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in with your Torn account.'; end if;
 select jsonb_build_object('enabled',true,'faction_id',s.faction_id,'consented_at',s.consented_at,'latest',(select private.faction_battle_snapshot_json(b) from private.faction_battle_snapshots b where b.user_id=s.user_id order by observed_at desc limit 1)) into result from private.faction_battle_shares s where s.user_id=auth.uid();
 return coalesce(result,jsonb_build_object('enabled',false));
end $$;

create function private.faction_battle_dashboard(window_days integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare membership public.torn_data_cache; basic public.torn_data_cache; roster public.torn_data_cache; faction bigint; identity bigint; rows_json jsonb;
begin
 if window_days is null or window_days not in (7,30,90) then raise exception 'Choose a 7, 30 or 90 day window.'; end if;
 membership:=private.faction_battle_proof('v2-user-faction');
 basic:=private.faction_battle_proof('v2-faction-basic');
 roster:=private.faction_battle_proof('v2-faction-members');
 faction:=(membership.payload#>>'{faction,id}')::bigint;
 select torn_id into identity from public.linked_torn_accounts where user_id=auth.uid() and revoked_at is null;
 if faction is null or faction<=0 or (basic.payload#>>'{basic,id}')::bigint is distinct from faction then raise exception 'Refresh verification for your current faction.'; end if;
 if identity is distinct from (basic.payload#>>'{basic,leader_id}')::bigint and identity is distinct from (basic.payload#>>'{basic,co_leader_id}')::bigint then raise exception 'Only your faction leader or co-leader can view shared member stats.'; end if;
 if jsonb_typeof(roster.payload->'members') is distinct from 'array' or jsonb_array_length(roster.payload->'members')>200 then raise exception 'A complete faction roster is required.'; end if;
 if not exists(select 1 from jsonb_array_elements(roster.payload->'members') m where (m->>'id')::bigint=identity) then raise exception 'You are not in this verified faction roster.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m->'id','name',m->>'name',
  'latest',case when s.user_id is null then null else (select private.faction_battle_snapshot_json(b) from private.faction_battle_snapshots b where b.user_id=s.user_id and b.faction_id=faction order by observed_at desc limit 1) end,
  'baseline',case when s.user_id is null then null else (select private.faction_battle_snapshot_json(b) from private.faction_battle_snapshots b where b.user_id=s.user_id and b.faction_id=faction and observed_at>=now()-make_interval(days=>window_days) order by observed_at asc limit 1) end
 ) order by m->>'name'),'[]'::jsonb) into rows_json
 from jsonb_array_elements(roster.payload->'members') m
 left join public.linked_torn_accounts a on a.torn_id=(m->>'id')::bigint and a.revoked_at is null
 left join private.faction_battle_shares s on s.user_id=a.user_id and s.torn_id=a.torn_id and s.faction_id=faction;
 return jsonb_build_object('faction_id',faction,'faction_name',basic.payload#>>'{basic,name}','verified_at',least(membership.fetched_at,basic.fetched_at,roster.fetched_at),'expires_at',least(membership.fetched_at,basic.fetched_at,roster.fetched_at)+interval '5 minutes','members',rows_json);
end $$;

create function public.set_faction_battle_sharing(enabled boolean) returns jsonb language sql security invoker set search_path='' as $$ select private.set_faction_battle_sharing(enabled) $$;
create function public.my_faction_battle_sharing() returns jsonb language sql security invoker set search_path='' as $$ select private.my_faction_battle_sharing() $$;
create function public.faction_battle_dashboard(window_days integer default 30) returns jsonb language sql security invoker set search_path='' as $$ select private.faction_battle_dashboard(window_days) $$;
revoke all on function private.faction_battle_proof(text) from public,anon,authenticated;
revoke all on function private.set_faction_battle_sharing(boolean),private.my_faction_battle_sharing(),private.faction_battle_dashboard(integer),public.set_faction_battle_sharing(boolean),public.my_faction_battle_sharing(),public.faction_battle_dashboard(integer) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.set_faction_battle_sharing(boolean),private.my_faction_battle_sharing(),private.faction_battle_dashboard(integer),public.set_faction_battle_sharing(boolean),public.my_faction_battle_sharing(),public.faction_battle_dashboard(integer) to authenticated;

-- A newly observed departure revokes the previous faction's access immediately.
create function private.revoke_departed_battle_sharing() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.endpoint_id='v2-user-faction' and new.parameters='{}'::jsonb then
  perform 1 from public.profiles where id=new.user_id for update;
  delete from private.faction_battle_shares where user_id=new.user_id and faction_id is distinct from (new.payload#>>'{faction,id}')::bigint;
 end if;
 return new;
end $$;
revoke all on function private.revoke_departed_battle_sharing() from public,anon,authenticated;
create trigger revoke_departed_battle_sharing after insert or update on public.torn_data_cache for each row execute function private.revoke_departed_battle_sharing();
