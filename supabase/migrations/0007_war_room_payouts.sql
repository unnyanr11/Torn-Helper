-- Torn Command Center - Phase 3 war room and payouts

create table public.wars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  enemy_faction_name text,
  status text not null default 'active' check (status in ('active','ended','cancelled')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.target_claims (
  id uuid primary key default gen_random_uuid(),
  war_id uuid not null references public.wars(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  torn_player_id bigint not null,
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  released_at timestamptz,
  unique (war_id, torn_player_id)
);

create table public.payout_policies (
  id uuid primary key default gen_random_uuid(),
  war_id uuid not null references public.wars(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('equal_per_hit','proportional','weighted','hybrid')),
  distributable_pool numeric not null check (distributable_pool >= 0),
  version int not null default 1,
  locked boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.payout_runs (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.payout_policies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','approved','paid')),
  total_allocated numeric not null default 0,
  created_at timestamptz not null default now()
);

create table public.payout_lines (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.payout_runs(id) on delete cascade,
  member_name text not null,
  hits int not null default 0,
  points numeric not null default 0,
  amount numeric not null default 0,
  paid boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_wars_user on public.wars(user_id);
create index idx_target_claims_war on public.target_claims(war_id);
create index idx_payout_policies_war on public.payout_policies(war_id);
create index idx_payout_runs_policy on public.payout_runs(policy_id);
create index idx_payout_lines_run on public.payout_lines(run_id);

alter table public.wars enable row level security;
alter table public.target_claims enable row level security;
alter table public.payout_policies enable row level security;
alter table public.payout_runs enable row level security;
alter table public.payout_lines enable row level security;

create policy "wars_all_own" on public.wars
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "target_claims_all_own" on public.target_claims
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "payout_policies_all_own" on public.payout_policies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "payout_runs_all_own" on public.payout_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "payout_lines_all_own" on public.payout_lines
  for all using (
    exists (select 1 from public.payout_runs r where r.id = run_id and r.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.payout_runs r where r.id = run_id and r.user_id = auth.uid())
  );
