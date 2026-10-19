-- Torn Command Center - Phase 34 chain target queue (spec section 5/7)

create table public.chain_target_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  torn_player_id bigint not null,
  player_name text,
  level int,
  status text not null default 'open' check (status in ('open','claimed','hit','skipped')),
  claimed_by text,
  claimed_at timestamptz,
  claimed_until timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, torn_player_id)
);

create index idx_chain_target_queue_user on public.chain_target_queue(user_id, status, created_at);
create index idx_chain_target_queue_player on public.chain_target_queue(torn_player_id);

alter table public.chain_target_queue enable row level security;
create policy "chain_target_queue_owner_all" on public.chain_target_queue for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
