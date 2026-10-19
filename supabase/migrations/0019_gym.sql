-- Torn Command Center - Phase 12 gym tracker

create table public.gym_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_date date not null default current_date,
  energy_spent int not null default 0 check (energy_spent >= 0),
  strength_gain numeric not null default 0 check (strength_gain >= 0),
  defense_gain numeric not null default 0 check (defense_gain >= 0),
  speed_gain numeric not null default 0 check (speed_gain >= 0),
  dexterity_gain numeric not null default 0 check (dexterity_gain >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create index idx_gym_sessions_user on public.gym_sessions(user_id, session_date);

alter table public.gym_sessions enable row level security;

create policy "gym_sessions_all_own" on public.gym_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
