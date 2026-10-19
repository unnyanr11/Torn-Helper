-- Torn Command Center - Phase 28 armory history & loans (spec section 9)

create table public.faction_armory_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_name text not null,
  event_type text not null check (event_type in ('added','removed','loaned','returned','sold')),
  quantity integer not null check (quantity > 0),
  member_torn_id bigint,
  member_name text,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_faction_armory_events_user on public.faction_armory_events(user_id, created_at);
create index idx_faction_armory_events_item on public.faction_armory_events(item_name);

create table public.faction_loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  borrower_torn_id bigint not null,
  borrower_name text not null,
  principal bigint not null check (principal > 0),
  interest_rate numeric not null default 0 check (interest_rate >= 0),
  due_date date,
  status text not null default 'active' check (status in ('active','repaid','defaulted','cancelled')),
  repaid_amount bigint not null default 0 check (repaid_amount >= 0),
  notes text,
  created_at timestamptz not null default now(),
  repaid_at timestamptz
);

create index idx_faction_loans_user on public.faction_loans(user_id, status, created_at);

alter table public.faction_armory_events enable row level security;
create policy "faction_armory_events_owner_all" on public.faction_armory_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.faction_loans enable row level security;
create policy "faction_loans_owner_all" on public.faction_loans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
