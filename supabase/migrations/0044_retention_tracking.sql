-- Torn Command Center - Phase 27 retention trends & join-leave tracking (spec section 9)

create table public.faction_membership_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_torn_id bigint not null,
  member_name text not null,
  event_type text not null check (event_type in ('joined','left','kicked')),
  event_date date not null,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_faction_membership_events_user on public.faction_membership_events(user_id, event_date);
create index idx_faction_membership_events_member on public.faction_membership_events(member_torn_id);

alter table public.faction_membership_events enable row level security;
create policy "faction_membership_events_owner_all" on public.faction_membership_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
