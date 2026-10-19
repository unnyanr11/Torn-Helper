-- Torn Command Center - Phase 35 daily digest (spec section 12)

create table public.daily_digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  digest_date date not null default current_date,
  energy_status text,
  pending_loans int not null default 0,
  overdue_loans int not null default 0,
  chain_status text,
  travel_opportunities int not null default 0,
  top_targets int not null default 0,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, digest_date)
);

create index idx_daily_digests_user on public.daily_digests(user_id, digest_date);

alter table public.daily_digests enable row level security;
create policy "daily_digests_owner_all" on public.daily_digests for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
