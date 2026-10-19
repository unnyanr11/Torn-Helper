-- Torn Command Center - Phase 14 custom stat columns

create table public.custom_columns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  unit text,
  type text not null default 'number' check (type in ('number','text')),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.custom_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  column_id uuid not null references public.custom_columns(id) on delete cascade,
  value text not null,
  recorded_at timestamptz not null default now()
);

create index idx_custom_columns_user on public.custom_columns(user_id);
create index idx_custom_entries_column on public.custom_entries(column_id, recorded_at);

alter table public.custom_columns enable row level security;
alter table public.custom_entries enable row level security;

create policy "custom_columns_all_own" on public.custom_columns
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "custom_entries_all_own" on public.custom_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
