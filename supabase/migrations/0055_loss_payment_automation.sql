-- Torn Command Center - Phase 38 loss marketplace payment automation
-- Xanax-based funding detection + attack-log verification + settlement ledger

-- Funding records: track buyer deposits (Xanax or cash) against contracts
create table public.loss_funding_records (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.loss_contracts(id) on delete cascade,
  buyer_user_id uuid not null references public.profiles(id) on delete cascade,
  amount bigint not null check (amount > 0),
  currency text not null default 'xanax' check (currency in ('xanax','cash')),
  transaction_ref text,
  sender_torn_id bigint,
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  verified_at timestamptz,
  verified_by text check (verified_by in ('auto','manual')),
  created_at timestamptz not null default now()
);

-- Attack evidence: verified loss attacks from seller's API key
create table public.loss_attack_evidence (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.loss_claims(id) on delete cascade,
  attack_id bigint not null unique,
  seller_torn_id bigint not null,
  target_torn_id bigint not null,
  attack_timestamp timestamptz not null,
  outcome text not null check (outcome in ('loss','win','other')),
  verified boolean not null default false,
  verified_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

-- Settlement ledger: track operator payouts to sellers
create table public.loss_settlement_entries (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.loss_claims(id) on delete cascade,
  seller_user_id uuid not null references public.profiles(id) on delete cascade,
  amount_owed bigint not null check (amount_owed >= 0),
  amount_paid bigint not null default 0 check (amount_paid >= 0),
  status text not null default 'earned' check (status in ('earned','approved','sent','reconciled','refunded')),
  approved_at timestamptz,
  sent_at timestamptz,
  reconciled_at timestamptz,
  transaction_ref text,
  notes text,
  created_at timestamptz not null default now()
);

-- Disputes: fraud flags / disputes on claims
create table public.loss_disputes (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.loss_claims(id) on delete cascade,
  raised_by uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open','resolved','rejected')),
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now()
);

create index idx_loss_funding_contract on public.loss_funding_records(contract_id, status);
create index idx_loss_evidence_claim on public.loss_attack_evidence(claim_id);
create index idx_loss_evidence_attack on public.loss_attack_evidence(attack_id);
create index idx_loss_settlement_claim on public.loss_settlement_entries(claim_id, status);
create index idx_loss_settlement_seller on public.loss_settlement_entries(seller_user_id, status);
create index idx_loss_disputes_claim on public.loss_disputes(claim_id, status);

alter table public.loss_funding_records enable row level security;
alter table public.loss_attack_evidence enable row level security;
alter table public.loss_settlement_entries enable row level security;
alter table public.loss_disputes enable row level security;

create policy "loss_funding_owner_all" on public.loss_funding_records for all using (auth.uid() = buyer_user_id) with check (auth.uid() = buyer_user_id);
create policy "loss_evidence_owner_all" on public.loss_attack_evidence for all using (true) with check (true);
create policy "loss_settlement_owner_all" on public.loss_settlement_entries for all using (auth.uid() = seller_user_id) with check (auth.uid() = seller_user_id);
create policy "loss_disputes_owner_all" on public.loss_disputes for all using (auth.uid() = raised_by) with check (auth.uid() = raised_by);
