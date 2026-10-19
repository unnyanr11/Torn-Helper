-- Torn Command Center - Phase 32 travel profit optimizer (spec section 10)

create table public.travel_profit_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  destination text not null,
  item_name text not null,
  buy_price numeric not null check (buy_price >= 0),
  sell_price numeric not null check (sell_price >= 0),
  quantity int not null check (quantity > 0),
  travel_cost numeric not null default 0 check (travel_cost >= 0),
  flight_minutes int not null default 0 check (flight_minutes >= 0),
  profit_total numeric not null default 0,
  profit_per_hour numeric not null default 0,
  created_at timestamptz not null default now()
);

create index idx_travel_profit_scenarios_user on public.travel_profit_scenarios(user_id, profit_per_hour);

alter table public.travel_profit_scenarios enable row level security;
create policy "travel_profit_scenarios_owner_all" on public.travel_profit_scenarios for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
