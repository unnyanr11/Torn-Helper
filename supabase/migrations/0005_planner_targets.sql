-- Torn Command Center - Phase 1 planner and levelling lists

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  kind text not null default 'custom' check (kind in ('levelling','money','training','custom')),
  target_value numeric,
  current_value numeric,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.target_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  mode text not null default 'levelling' check (mode in ('levelling','respect','chain','ranked-war','bounty','seasonal')),
  created_at timestamptz not null default now()
);

create table public.target_list_entries (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.target_lists(id) on delete cascade,
  torn_player_id bigint not null,
  player_name text,
  level int,
  status text,
  last_checked_at timestamptz,
  notes text,
  excluded boolean not null default false,
  created_at timestamptz not null default now(),
  unique (list_id, torn_player_id)
);

create index idx_goals_user on public.goals(user_id);
create index idx_target_lists_user on public.target_lists(user_id);
create index idx_target_list_entries_list on public.target_list_entries(list_id);

alter table public.goals enable row level security;
alter table public.target_lists enable row level security;
alter table public.target_list_entries enable row level security;

create policy "goals_all_own" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "target_lists_all_own" on public.target_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "target_list_entries_all_own" on public.target_list_entries
  for all using (
    exists (select 1 from public.target_lists l where l.id = list_id and l.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.target_lists l where l.id = list_id and l.user_id = auth.uid())
  );
