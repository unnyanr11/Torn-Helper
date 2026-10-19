-- Torn Command Center - Phase 26 deeper alliance sharing & revocation (spec section 7C #14)

create table public.alliance_sharing_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  alliance_name text not null,
  resource_type text not null check (resource_type in ('target_list','spy_report','war_report','ledger','custom')),
  resource_id uuid,
  granted_to_role text not null default 'member' check (granted_to_role in ('member','officer','leader')),
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index idx_alliance_sharing_grants_user on public.alliance_sharing_grants(user_id, status, created_at);
create index idx_alliance_sharing_grants_alliance on public.alliance_sharing_grants(alliance_name, status);

alter table public.alliance_sharing_grants enable row level security;
create policy "alliance_sharing_grants_owner_all" on public.alliance_sharing_grants for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
