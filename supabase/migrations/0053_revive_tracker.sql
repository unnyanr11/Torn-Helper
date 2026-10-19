-- Torn Command Center - Phase 36 revive tracker (spec section 4/7)

create table public.revive_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reviver_torn_id bigint not null,
  reviver_name text not null,
  target_torn_id bigint not null,
  target_name text,
  revive_type text not null default 'normal' check (revive_type in ('normal','medical','event')),
  revived_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index idx_revive_logs_user on public.revive_logs(user_id, revived_at);
create index idx_revive_logs_reviver on public.revive_logs(reviver_torn_id, revived_at);
create index idx_revive_logs_target on public.revive_logs(target_torn_id);

alter table public.revive_logs enable row level security;
create policy "revive_logs_owner_all" on public.revive_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
