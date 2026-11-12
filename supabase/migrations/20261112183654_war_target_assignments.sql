-- Only the authenticated gateway writes verified war assignments. Editable app
-- rosters, position labels and browser-submitted faction IDs grant no authority.
create table public.war_target_lists (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 faction_id bigint not null check(faction_id>0),
 war_key text not null,
 enemy_faction_id bigint not null check(enemy_faction_id>0),
 target_ids bigint[] not null default '{}',
 targets jsonb not null default '[]' check(jsonb_typeof(targets)='array' and jsonb_array_length(targets)<=100),
 active boolean not null default true,
 alerts_enabled boolean not null default true,
 updated_by bigint not null check(updated_by>0),
 revision bigint not null default 1,
 verified_until timestamptz not null,
 updated_at timestamptz not null default now(),
 check(cardinality(target_ids)<=100)
);
alter table public.war_target_lists enable row level security;
revoke all on public.war_target_lists from public,anon,authenticated;
grant select on public.war_target_lists to authenticated;
grant all on public.war_target_lists to service_role;
create policy war_target_owner_read on public.war_target_lists for select to authenticated
 using(user_id=(select auth.uid()) and exists(select 1 from public.linked_torn_accounts a where a.user_id=(select auth.uid()) and a.revoked_at is null));
alter publication supabase_realtime add table public.war_target_lists;
