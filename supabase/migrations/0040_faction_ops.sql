-- Torn Command Center - Phase 23 faction operations depth (spec section 7C)

create table public.faction_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  torn_id bigint not null,
  name text not null,
  role text not null default 'Member',
  level integer not null default 1,
  last_action text,
  contribution integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, torn_id)
);

create index idx_faction_members_user on public.faction_members(user_id, level);

create table public.faction_chain_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  current_chain integer not null default 0,
  chain_timeout_seconds integer not null default 0,
  best_chain integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table public.faction_armory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_name text not null,
  quantity integer not null default 0 check (quantity >= 0),
  total_value bigint not null default 0,
  created_at timestamptz not null default now()
);

create index idx_faction_armory_user on public.faction_armory(user_id);

create table public.faction_territory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  territory_name text not null,
  controlled boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, territory_name)
);

alter table public.faction_members enable row level security;
create policy "faction_members_owner_all" on public.faction_members for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.faction_chain_state enable row level security;
create policy "faction_chain_state_owner_all" on public.faction_chain_state for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.faction_armory enable row level security;
create policy "faction_armory_owner_all" on public.faction_armory for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.faction_territory enable row level security;
create policy "faction_territory_owner_all" on public.faction_territory for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
