-- Torn Command Center - Phase 4 company and properties

create table public.company_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  company_name text,
  daily_profit numeric,
  employees int,
  notes text,
  snapshot_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.property_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  property_name text not null,
  property_type text not null default 'house' check (property_type in ('house','apartment','pi','other')),
  upkeep numeric not null default 0,
  rent_income numeric not null default 0,
  value numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_company_snapshots_user on public.company_snapshots(user_id);
create index idx_property_records_user on public.property_records(user_id);

alter table public.company_snapshots enable row level security;
alter table public.property_records enable row level security;

create policy "company_snapshots_all_own" on public.company_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "property_records_all_own" on public.property_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
