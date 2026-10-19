-- Torn Command Center - Phase 37 revive marketplace (spec section 7A pattern)

create table public.revive_contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_torn_id bigint not null,
  target_name text,
  quantity int not null check (quantity > 0),
  price_per_revive bigint not null check (price_per_revive > 0),
  status text not null default 'open' check (status in ('open','paused','cancelled','completed')),
  expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table public.revive_claims (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.revive_contracts(id) on delete cascade,
  seller_user_id uuid not null references public.profiles(id) on delete cascade,
  seller_torn_id bigint not null,
  seller_name text not null,
  quantity_claimed int not null default 1 check (quantity_claimed > 0),
  status text not null default 'active' check (status in ('active','completed','expired','cancelled')),
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  completed_at timestamptz,
  notes text
);

create table public.revive_evidence (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.revive_claims(id) on delete cascade,
  revive_log_id uuid references public.revive_logs(id) on delete set null,
  evidence_type text not null default 'revive_log' check (evidence_type in ('revive_log','manual')),
  verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (claim_id, revive_log_id)
);

create index idx_revive_contracts_user on public.revive_contracts(user_id, status);
create index idx_revive_claims_contract on public.revive_claims(contract_id, status);
create index idx_revive_claims_seller on public.revive_claims(seller_user_id, status);
create index idx_revive_evidence_claim on public.revive_evidence(claim_id);

alter table public.revive_contracts enable row level security;
alter table public.revive_claims enable row level security;
alter table public.revive_evidence enable row level security;

create policy "revive_contracts_owner_all" on public.revive_contracts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "revive_claims_owner_all" on public.revive_claims for all using (auth.uid() = seller_user_id) with check (auth.uid() = seller_user_id);
create policy "revive_evidence_owner_all" on public.revive_evidence for all using (true) with check (true);
