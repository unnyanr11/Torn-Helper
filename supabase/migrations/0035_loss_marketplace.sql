-- Torn Command Center - Phase 18 Loss Marketplace (spec section 7A)

create table public.loss_contracts (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  target_torn_id bigint not null,
  target_name text,
  price_per_loss_cents integer not null check (price_per_loss_cents > 0),
  quantity_total integer not null check (quantity_total > 0),
  quantity_reserved integer not null default 0,
  quantity_verified integer not null default 0,
  budget_cents integer not null check (budget_cents > 0),
  status text not null default 'draft' check (status in ('draft','funded','active','paused','completed','cancelled','expired')),
  eligibility jsonb not null default '{}',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_loss_contracts_buyer on public.loss_contracts(buyer_id, status);
create index idx_loss_contracts_status on public.loss_contracts(status, expires_at);

create table public.loss_claims (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.loss_contracts(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  quantity_claimed integer not null check (quantity_claimed > 0),
  status text not null default 'active' check (status in ('active','completed','expired','cancelled')),
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (contract_id, seller_id, status)
);

create index idx_loss_claims_seller on public.loss_claims(seller_id, status);
create index idx_loss_claims_contract on public.loss_claims(contract_id, status);

create table public.loss_evidence (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.loss_claims(id) on delete cascade,
  attack_id bigint not null unique,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  target_torn_id bigint not null,
  occurred_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_loss_evidence_claim on public.loss_evidence(claim_id, status);
create index idx_loss_evidence_seller on public.loss_evidence(seller_id, status);

create table public.funding_records (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.loss_contracts(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending','confirmed','refunded')),
  created_at timestamptz not null default now()
);

create index idx_funding_records_contract on public.funding_records(contract_id, status);

create table public.settlement_entries (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.loss_contracts(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'earned' check (status in ('earned','approved','paid','reconciled','refunded')),
  created_at timestamptz not null default now()
);

create index idx_settlement_entries_contract on public.settlement_entries(contract_id, status);
create index idx_settlement_entries_seller on public.settlement_entries(seller_id, status);

create table public.loss_disputes (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.loss_contracts(id) on delete cascade,
  claim_id uuid references public.loss_claims(id) on delete set null,
  raised_by uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open','resolved','rejected')),
  resolution_notes text,
  created_at timestamptz not null default now()
);

create index idx_loss_disputes_contract on public.loss_disputes(contract_id, status);

-- RLS: buyers own their contracts
alter table public.loss_contracts enable row level security;
create policy "loss_contracts_buyer_all" on public.loss_contracts
  for all using (auth.uid() = buyer_id) with check (auth.uid() = buyer_id);
create policy "loss_contracts_seller_read" on public.loss_contracts
  for select using (status in ('funded','active'));

-- RLS: sellers own their claims
alter table public.loss_claims enable row level security;
create policy "loss_claims_seller_all" on public.loss_claims
  for all using (auth.uid() = seller_id) with check (auth.uid() = seller_id);
create policy "loss_claims_buyer_read" on public.loss_claims
  for select using (exists (select 1 from public.loss_contracts c where c.id = contract_id and c.buyer_id = auth.uid()));

-- RLS: evidence scoped to claim owner or contract buyer
alter table public.loss_evidence enable row level security;
create policy "loss_evidence_seller_all" on public.loss_evidence
  for all using (auth.uid() = seller_id) with check (auth.uid() = seller_id);
create policy "loss_evidence_buyer_read" on public.loss_evidence
  for select using (exists (select 1 from public.loss_claims lc join public.loss_contracts c on c.id = lc.contract_id where lc.id = claim_id and c.buyer_id = auth.uid()));

-- RLS: funding records buyer-only
alter table public.funding_records enable row level security;
create policy "funding_records_buyer_all" on public.funding_records
  for all using (auth.uid() = buyer_id) with check (auth.uid() = buyer_id);

-- RLS: settlement entries seller or contract buyer
alter table public.settlement_entries enable row level security;
create policy "settlement_entries_seller_read" on public.settlement_entries
  for select using (auth.uid() = seller_id);
create policy "settlement_entries_buyer_all" on public.settlement_entries
  for all using (exists (select 1 from public.loss_contracts c where c.id = contract_id and c.buyer_id = auth.uid())) with check (exists (select 1 from public.loss_contracts c where c.id = contract_id and c.buyer_id = auth.uid()));

-- RLS: disputes raised_by or contract buyer
alter table public.loss_disputes enable row level security;
create policy "loss_disputes_raiser_all" on public.loss_disputes
  for all using (auth.uid() = raised_by) with check (auth.uid() = raised_by);
create policy "loss_disputes_buyer_read" on public.loss_disputes
  for select using (exists (select 1 from public.loss_contracts c where c.id = contract_id and c.buyer_id = auth.uid()));
