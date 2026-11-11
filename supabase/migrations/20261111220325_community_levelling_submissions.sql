-- Public player references, shared with signed-in users; identities of contributors stay private.
create table public.community_levelling_targets (
 torn_id bigint primary key check(torn_id>0 and torn_id<=9007199254740991),
 player_name text not null check(length(btrim(player_name)) between 1 and 100),
 level integer not null check(level between 1 and 100),
 last_action_at timestamptz not null,
 verified_at timestamptz not null default clock_timestamp(),
 submitted_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default clock_timestamp(),
 constraint community_target_inactive_at_verification check(last_action_at<=verified_at-interval '240 hours')
);
alter table public.community_levelling_targets enable row level security;
create policy signed_in_target_read on public.community_levelling_targets for select to authenticated using(true);
revoke all on public.community_levelling_targets from public,anon,authenticated;
grant select(torn_id,player_name,level,last_action_at,verified_at) on public.community_levelling_targets to authenticated;
grant all on public.community_levelling_targets to service_role;
create function private.record_community_levelling_target(owner_id uuid,player_id bigint,player_name text,player_level integer,last_action_epoch bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result public.community_levelling_targets; observed timestamptz:=clock_timestamp();last_action timestamptz;
begin
 if owner_id is null or not exists(select 1 from public.linked_torn_accounts where user_id=owner_id and revoked_at is null) then raise exception 'An active linked Torn account is required';end if;
 if player_id is null or player_id not between 1 and 9007199254740991 or player_name is null or length(btrim(player_name)) not between 1 and 100 or player_level is null or player_level not between 1 and 100 then raise exception 'Invalid verified player profile';end if;
 if last_action_epoch is null or last_action_epoch<=0 or last_action_epoch>floor(extract(epoch from observed-interval '240 hours')) then raise exception 'The official last action must be at least 10 days ago';end if;
 last_action:=to_timestamp(last_action_epoch);
 insert into public.community_levelling_targets as t(torn_id,player_name,level,last_action_at,verified_at,submitted_by)
 values(player_id,btrim(player_name),player_level,last_action,observed,owner_id)
 on conflict(torn_id) do update set player_name=excluded.player_name,level=excluded.level,last_action_at=excluded.last_action_at,verified_at=excluded.verified_at
 returning * into result;
 return jsonb_build_object('torn_id',result.torn_id,'player_name',result.player_name,'level',result.level,'last_action_at',result.last_action_at,'verified_at',result.verified_at);
end $$;
create function public.record_community_levelling_target(owner_id uuid,player_id bigint,player_name text,player_level integer,last_action_epoch bigint) returns jsonb
language sql security invoker set search_path='' as $$select private.record_community_levelling_target(owner_id,player_id,player_name,player_level,last_action_epoch)$$;
revoke all on function private.record_community_levelling_target(uuid,bigint,text,integer,bigint),public.record_community_levelling_target(uuid,bigint,text,integer,bigint) from public,anon,authenticated;
grant execute on function private.record_community_levelling_target(uuid,bigint,text,integer,bigint),public.record_community_levelling_target(uuid,bigint,text,integer,bigint) to service_role;
