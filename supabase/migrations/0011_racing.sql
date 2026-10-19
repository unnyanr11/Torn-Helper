-- Torn Command Center - Phase 4 racing

create table public.racing_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  track_name text not null,
  car_name text,
  position int,
  time_ms bigint,
  raced_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index idx_racing_records_user on public.racing_records(user_id);

alter table public.racing_records enable row level security;

create policy "racing_records_all_own" on public.racing_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
