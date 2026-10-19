-- Torn Command Center - Phase 19 full payout calculator (spec section 8)

create table public.payout_policies (
  id uuid primary key default gen_random_uuid(),
  war_id uuid references public.wars(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft','published','locked','approved','reconciled')),
  mode text not null check (mode in ('equal','proportional','weighted','hybrid')),
  config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_payout_policies_war on public.payout_policies(war_id, version);
create index idx_payout_policies_creator on public.payout_policies(created_by, status);

create table public.payout_runs (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.payout_policies(id) on delete cascade,
  total_pool_cents integer not null check (total_pool_cents >= 0),
  allocated_cents integer not null default 0,
  retained_cents integer not null default 0,
  status text not null default 'preview' check (status in ('preview','locked','approved','paid','reconciled')),
  created_at timestamptz not null default now()
);

create index idx_payout_runs_policy on public.payout_runs(policy_id, status);

create table public.payout_lines (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.payout_runs(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  eligible_points integer not null default 0,
  share_cents integer not null default 0,
  bonus_cents integer not null default 0,
  reimbursement_cents integer not null default 0,
  adjustment_cents integer not null default 0,
  amount_owed_cents integer not null default 0,
  paid_cents integer not null default 0,
  status text not null default 'pending' check (status in ('pending','paid','adjusted')),
  explanation text,
  created_at timestamptz not null default now()
);

create index idx_payout_lines_run on public.payout_lines(run_id, status);
create index idx_payout_lines_member on public.payout_lines(member_id);

create table public.payout_audit (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.payout_runs(id) on delete cascade,
  action text not null,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_payout_audit_run on public.payout_audit(run_id, created_at);

alter table public.payout_policies enable row level security;
create policy "payout_policies_owner_all" on public.payout_policies
  for all using (auth.uid() = created_by) with check (auth.uid() = created_by);

alter table public.payout_runs enable row level security;
create policy "payout_runs_owner_all" on public.payout_runs
  for all using (exists (select 1 from public.payout_policies p where p.id = policy_id and p.created_by = auth.uid()))
  with check (exists (select 1 from public.payout_policies p where p.id = policy_id and p.created_by = auth.uid()));

alter table public.payout_lines enable row level security;
create policy "payout_lines_owner_all" on public.payout_lines
  for all using (exists (select 1 from public.payout_runs r join public.payout_policies p on p.id = r.policy_id where r.id = run_id and p.created_by = auth.uid()))
  with check (exists (select 1 from public.payout_runs r join public.payout_policies p on p.id = r.policy_id where r.id = run_id and p.created_by = auth.uid()));
create policy "payout_lines_member_read" on public.payout_lines
  for select using (auth.uid() = member_id);

alter table public.payout_audit enable row level security;
create policy "payout_audit_owner_all" on public.payout_audit
  for all using (auth.uid() = actor_id) with check (auth.uid() = actor_id);
