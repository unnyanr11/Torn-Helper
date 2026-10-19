-- Torn Command Center - Phase 15 hospital-timer dibs

create table public.dibs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  war_id uuid references public.wars(id) on delete set null,
  target_torn_id bigint not null,
  target_name text,
  claimed_until timestamptz not null,
  status text not null default 'active' check (status in ('active','expired','hit')),
  created_at timestamptz not null default now()
);

create index idx_dibs_user on public.dibs(user_id, status, claimed_until);

alter table public.dibs enable row level security;

create policy "dibs_all_own" on public.dibs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
