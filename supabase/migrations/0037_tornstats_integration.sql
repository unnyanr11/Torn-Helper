-- Torn Command Center - Phase 20 TornStats integration (spec section 7C #13)

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('tornstats')),
  token_encrypted text,
  status text not null default 'connected' check (status in ('connected','disconnected','revoked')),
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz,
  unique (user_id, provider)
);

create index idx_integration_connections_user on public.integration_connections(user_id, provider, status);

create table public.spy_import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'tornstats',
  target_torn_id bigint not null,
  status text not null default 'pending' check (status in ('pending','complete','failed')),
  result jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index idx_spy_import_jobs_user on public.spy_import_jobs(user_id, status, created_at);
create index idx_spy_import_jobs_target on public.spy_import_jobs(target_torn_id);

alter table public.integration_connections enable row level security;
create policy "integration_connections_owner_all" on public.integration_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.spy_import_jobs enable row level security;
create policy "spy_import_jobs_owner_all" on public.spy_import_jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
