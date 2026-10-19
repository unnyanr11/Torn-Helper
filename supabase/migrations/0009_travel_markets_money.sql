-- Torn Command Center - Phase 4 travel, markets, and money

create table public.travel_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  destination text not null,
  item_name text,
  price numeric,
  observed_at timestamptz not null default now(),
  source text not null default 'manual input'
);

create table public.market_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id bigint not null,
  item_name text,
  price numeric,
  observed_at timestamptz not null default now(),
  source text not null default 'manual input'
);

create table public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id bigint not null,
  item_name text,
  threshold_price numeric,
  created_at timestamptz not null default now(),
  unique (user_id, item_id)
);

create table public.stock_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stock_id text not null,
  shares numeric not null default 0 check (shares >= 0),
  avg_cost numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, stock_id)
);

create index idx_travel_observations_user on public.travel_observations(user_id);
create index idx_market_snapshots_user on public.market_snapshots(user_id, item_id);
create index idx_watchlists_user on public.watchlists(user_id);
create index idx_stock_holdings_user on public.stock_holdings(user_id);

alter table public.travel_observations enable row level security;
alter table public.market_snapshots enable row level security;
alter table public.watchlists enable row level security;
alter table public.stock_holdings enable row level security;

create policy "travel_observations_all_own" on public.travel_observations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "market_snapshots_all_own" on public.market_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "watchlists_all_own" on public.watchlists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "stock_holdings_all_own" on public.stock_holdings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
