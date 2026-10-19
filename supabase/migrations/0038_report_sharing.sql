-- Torn Command Center - Phase 21 report export & sharing (spec section 7C #16)

create table public.report_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  data jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index idx_report_snapshots_user on public.report_snapshots(user_id, created_at);

create table public.report_share_grants (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.report_snapshots(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  expires_at timestamptz not null,
  revoked boolean not null default false,
  audience text not null default 'link',
  created_at timestamptz not null default now()
);

create index idx_report_share_grants_snapshot on public.report_share_grants(snapshot_id, revoked, expires_at);

alter table public.report_snapshots enable row level security;
create policy "report_snapshots_owner_all" on public.report_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.report_share_grants enable row level security;
create policy "report_share_grants_owner_all" on public.report_share_grants
  for all using (exists (select 1 from public.report_snapshots s where s.id = snapshot_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.report_snapshots s where s.id = snapshot_id and s.user_id = auth.uid()));
