-- Torn Command Center - Phase 25 faction upgrade simulation (spec section 9)

create table public.faction_upgrade_simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  branch_name text not null,
  current_level integer not null default 0 check (current_level >= 0),
  target_level integer not null default 1 check (target_level >= 1),
  respect_per_level bigint not null default 0 check (respect_per_level >= 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, branch_name)
);

create index idx_faction_upgrade_simulations_user on public.faction_upgrade_simulations(user_id);

alter table public.faction_upgrade_simulations enable row level security;
create policy "faction_upgrade_simulations_owner_all" on public.faction_upgrade_simulations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
