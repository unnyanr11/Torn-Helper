-- Torn Command Center - Phase 8 estimate integrations

create table public.estimate_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null check (source in ('ffscouter','tornstats')),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, source)
);

alter table public.estimate_settings enable row level security;

create policy "estimate_settings_all_own" on public.estimate_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
