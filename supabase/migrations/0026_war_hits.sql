-- Torn Command Center - Phase 15 war hit counter

create table public.war_hits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  war_id uuid not null references public.wars(id) on delete cascade,
  attacker_name text not null,
  target_torn_id bigint not null,
  hits int not null default 1 check (hits > 0),
  recorded_at timestamptz not null default now()
);

create index idx_war_hits_war on public.war_hits(war_id, attacker_name, recorded_at);

alter table public.war_hits enable row level security;

create policy "war_hits_all_own" on public.war_hits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
