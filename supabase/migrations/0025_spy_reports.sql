-- Torn Command Center - Phase 15 spy reports

create table public.spy_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_torn_id bigint not null,
  target_name text,
  strength bigint,
  defense bigint,
  speed bigint,
  dexterity bigint,
  total bigint,
  reported_at timestamptz not null default now()
);

create index idx_spy_reports_user on public.spy_reports(user_id, target_torn_id, reported_at);

alter table public.spy_reports enable row level security;

create policy "spy_reports_all_own" on public.spy_reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
