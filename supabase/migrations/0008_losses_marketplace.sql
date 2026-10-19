-- Torn Command Center - Phase 3 losses marketplace
-- Direct-payment contracts only: no operator custody or automatic payouts.

create table public.loss_contracts (
  id uuid primary key default gen_random_uuid(),
  buyer_user_id uuid not null references public.profiles(id) on delete cascade,
  target_player_id bigint not null,
  target_name text,
  quantity int not null check (quantity > 0),
  price_per_loss numeric not null check (price_per_loss >= 0),
  status text not null default 'open' check (status in ('open','paused','cancelled','completed')),
  funding_method text not null default 'direct_payment' check (funding_method in ('direct_payment')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.loss_claims (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.loss_contracts(id) on delete cascade,
  seller_user_id uuid not null references public.profiles(id) on delete cascade,
  quantity int not null check (quantity > 0),
  status text not null default 'active' check (status in ('active','completed','expired','cancelled')),
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz
);

create table public.loss_evidence (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.loss_claims(id) on delete cascade,
  attack_id text not null,
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (claim_id, attack_id)
);

create table public.funding_records (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.loss_contracts(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  method text not null default 'manual_confirmation',
  confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.settlement_entries (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.loss_claims(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending','approved','sent','reconciled','refunded')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create table public.loss_disputes (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.loss_claims(id) on delete cascade,
  raised_by uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open','resolved','rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index idx_loss_contracts_buyer on public.loss_contracts(buyer_user_id);
create index idx_loss_claims_contract on public.loss_claims(contract_id);
create index idx_loss_claims_seller on public.loss_claims(seller_user_id);
create index idx_loss_evidence_claim on public.loss_evidence(claim_id);
create index idx_funding_records_contract on public.funding_records(contract_id);
create index idx_settlement_entries_claim on public.settlement_entries(claim_id);
create index idx_loss_disputes_claim on public.loss_disputes(claim_id);

alter table public.loss_contracts enable row level security;
alter table public.loss_claims enable row level security;
alter table public.loss_evidence enable row level security;
alter table public.funding_records enable row level security;
alter table public.settlement_entries enable row level security;
alter table public.loss_disputes enable row level security;

create policy "loss_contracts_select_participants" on public.loss_contracts
  for select using (auth.uid() = buyer_user_id);
create policy "loss_contracts_insert_own" on public.loss_contracts
  for insert with check (auth.uid() = buyer_user_id);
create policy "loss_contracts_update_own" on public.loss_contracts
  for update using (auth.uid() = buyer_user_id);
create policy "loss_contracts_delete_own" on public.loss_contracts
  for delete using (auth.uid() = buyer_user_id);

create policy "loss_claims_select_participants" on public.loss_claims
  for select using (
    auth.uid() = seller_user_id
    or exists (select 1 from public.loss_contracts c where c.id = contract_id and c.buyer_user_id = auth.uid())
  );
create policy "loss_claims_insert_own" on public.loss_claims
  for insert with check (auth.uid() = seller_user_id);
create policy "loss_claims_update_own" on public.loss_claims
  for update using (auth.uid() = seller_user_id);

create policy "loss_evidence_select_participants" on public.loss_evidence
  for select using (
    exists (
      select 1 from public.loss_claims cl
      join public.loss_contracts c on c.id = cl.contract_id
      where cl.id = claim_id and (cl.seller_user_id = auth.uid() or c.buyer_user_id = auth.uid())
    )
  );
create policy "loss_evidence_insert_seller" on public.loss_evidence
  for insert with check (
    exists (select 1 from public.loss_claims cl where cl.id = claim_id and cl.seller_user_id = auth.uid())
  );

create policy "funding_records_select_buyer" on public.funding_records
  for select using (
    exists (select 1 from public.loss_contracts c where c.id = contract_id and c.buyer_user_id = auth.uid())
  );
create policy "funding_records_insert_buyer" on public.funding_records
  for insert with check (
    exists (select 1 from public.loss_contracts c where c.id = contract_id and c.buyer_user_id = auth.uid())
  );

create policy "settlement_entries_select_participants" on public.settlement_entries
  for select using (
    exists (
      select 1 from public.loss_claims cl
      join public.loss_contracts c on c.id = cl.contract_id
      where cl.id = claim_id and (cl.seller_user_id = auth.uid() or c.buyer_user_id = auth.uid())
    )
  );

create policy "loss_disputes_select_participants" on public.loss_disputes
  for select using (
    exists (
      select 1 from public.loss_claims cl
      join public.loss_contracts c on c.id = cl.contract_id
      where cl.id = claim_id and (cl.seller_user_id = auth.uid() or c.buyer_user_id = auth.uid() or raised_by = auth.uid())
    )
  );
create policy "loss_disputes_insert_participant" on public.loss_disputes
  for insert with check (raised_by = auth.uid());
