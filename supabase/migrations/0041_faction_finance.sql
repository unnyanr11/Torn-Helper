-- Torn Command Center - Phase 24 faction money requests & ledger (spec section 9)

create table public.faction_money_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  requester_torn_id bigint not null,
  requester_name text not null,
  amount bigint not null check (amount > 0),
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','paid')),
  reviewed_by text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index idx_faction_money_requests_user on public.faction_money_requests(user_id, status, created_at);

create table public.faction_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  entry_type text not null check (entry_type in ('deposit','withdrawal','loan','repayment','expense','income')),
  amount bigint not null,
  balance_after bigint not null default 0,
  description text,
  related_request_id uuid references public.faction_money_requests(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_faction_ledger_entries_user on public.faction_ledger_entries(user_id, created_at);

alter table public.faction_money_requests enable row level security;
create policy "faction_money_requests_owner_all" on public.faction_money_requests for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.faction_ledger_entries enable row level security;
create policy "faction_ledger_entries_owner_all" on public.faction_ledger_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
