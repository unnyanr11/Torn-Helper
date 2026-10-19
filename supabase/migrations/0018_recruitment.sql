-- Torn Command Center - Phase 11 recruitment scanner

create table public.recruitment_requirements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  min_level int not null default 1,
  max_level int not null default 100,
  require_factionless boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id)
);

create table public.recruitment_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  torn_player_id bigint not null,
  player_name text not null,
  level int,
  faction_id bigint,
  faction_name text,
  last_action text,
  stage text not null default 'new' check (stage in ('new','shortlisted','contacted','rejected','joined')),
  match_score int,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, torn_player_id)
);

create index idx_recruitment_candidates_user on public.recruitment_candidates(user_id, stage);

alter table public.recruitment_requirements enable row level security;
alter table public.recruitment_candidates enable row level security;

create policy "recruitment_requirements_all_own" on public.recruitment_requirements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "recruitment_candidates_all_own" on public.recruitment_candidates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
