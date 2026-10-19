-- Torn Command Center - Phase 13 activity heatmaps

create table public.activity_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_type text not null check (subject_type in ('player','faction')),
  subject_id bigint not null,
  subject_name text,
  observed_at timestamptz not null default now(),
  status text not null check (status in ('online','idle','offline')),
  notes text,
  created_at timestamptz not null default now()
);

create index idx_activity_obs_user on public.activity_observations(user_id, subject_type, subject_id, observed_at);

alter table public.activity_observations enable row level security;

create policy "activity_observations_all_own" on public.activity_observations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
