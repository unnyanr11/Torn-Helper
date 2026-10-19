alter table public.profiles add column history_enabled boolean not null default false;
grant update(history_enabled) on public.profiles to authenticated;
create table public.personal_stat_snapshots (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 captured_at timestamptz not null default now(),
 source text not null default 'official_api' check(source='official_api'),
 stat_values jsonb not null check(jsonb_typeof(stat_values)='object' and octet_length(stat_values::text)<=200000),
 unique(user_id,captured_at)
);
alter table public.personal_stat_snapshots enable row level security;
create policy own_history on public.personal_stat_snapshots for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.personal_stat_snapshots from anon,authenticated;
grant select on public.personal_stat_snapshots to authenticated;
grant all on public.personal_stat_snapshots to service_role;
-- Serialize snapshots with privacy toggles; paused/disabled profiles never receive new history.
create function private.record_personal_snapshot(owner_id uuid,observed_at timestamptz,values_json jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare p public.profiles;
begin
 if auth.role()<>'service_role' then raise exception 'Service only'; end if;
 select * into p from public.profiles where id=owner_id for update;
 if not found or p.tracking_paused or not p.history_enabled then return false; end if;
 if observed_at is null or observed_at>now()+interval '1 minute' or observed_at<now()-interval '5 minutes' then raise exception 'Invalid observation time'; end if;
 if values_json is null or values_json='{}'::jsonb then return false; end if;
 if jsonb_typeof(values_json)<>'object' then raise exception 'Invalid stat values'; end if;
 if exists(select 1 from jsonb_each(values_json) v where jsonb_typeof(v.value)<>'number' or length(v.key)>200 or v.key !~ '^(battlestats|personalstats)\.') then raise exception 'Only numeric personal stat paths are accepted'; end if;
 if exists(select 1 from public.personal_stat_snapshots where user_id=owner_id and captured_at>observed_at-interval '60 seconds') then return false; end if;
 insert into public.personal_stat_snapshots(user_id,captured_at,stat_values) values(owner_id,observed_at,values_json);
 return true;
end $$;
create function public.record_personal_snapshot(owner_id uuid,observed_at timestamptz,values_json jsonb) returns boolean language sql security invoker set search_path='' as $$select private.record_personal_snapshot(owner_id,observed_at,values_json)$$;
revoke all on function private.record_personal_snapshot(uuid,timestamptz,jsonb) from public,anon,authenticated;
revoke all on function public.record_personal_snapshot(uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function private.record_personal_snapshot(uuid,timestamptz,jsonb) to service_role;
grant execute on function public.record_personal_snapshot(uuid,timestamptz,jsonb) to service_role;
