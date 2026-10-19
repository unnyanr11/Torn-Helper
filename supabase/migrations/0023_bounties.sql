-- Torn Command Center - Phase 14 bounties

create table public.bounties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_torn_id bigint not null,
  target_name text,
  amount bigint not null check (amount > 0),
  status text not null default 'open' check (status in ('open','claimed','expired')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_bounties_user on public.bounties(user_id, status, created_at);

alter table public.bounties enable row level security;

create policy "bounties_all_own" on public.bounties
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
