-- Torn Command Center - Phase 15 target pools

create table public.target_pools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  target_torn_ids bigint[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index idx_target_pools_user on public.target_pools(user_id);

alter table public.target_pools enable row level security;

create policy "target_pools_all_own" on public.target_pools
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
