-- Torn Command Center - Phase 15 crime tracker

create table public.crime_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  crime_name text not null,
  attempts int not null default 1 check (attempts > 0),
  successes int not null default 0 check (successes >= 0),
  recorded_at timestamptz not null default now()
);

create index idx_crime_logs_user on public.crime_logs(user_id, crime_name, recorded_at);

alter table public.crime_logs enable row level security;

create policy "crime_logs_all_own" on public.crime_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
