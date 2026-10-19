-- Torn Command Center - Phase 15 flight tracker

create table public.flight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  destination text not null,
  departed_at timestamptz,
  arrives_at timestamptz,
  status text not null default 'in_flight' check (status in ('in_flight','arrived','returned')),
  notes text,
  created_at timestamptz not null default now()
);

create index idx_flight_logs_user on public.flight_logs(user_id, status, created_at);

alter table public.flight_logs enable row level security;

create policy "flight_logs_all_own" on public.flight_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
