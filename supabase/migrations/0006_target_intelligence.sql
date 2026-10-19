-- Torn Command Center - Phase 2 target intelligence

create table public.player_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  torn_player_id bigint not null,
  status text,
  level int,
  last_action text,
  observed_at timestamptz not null default now(),
  source text not null default 'official API'
);

create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  torn_player_id bigint not null,
  estimate_type text not null check (estimate_type in ('ff_derived','spy_report','manual')),
  value jsonb not null,
  source text not null,
  confidence text not null default 'low' check (confidence in ('low','medium','high')),
  created_at timestamptz not null default now()
);

create table public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  condition_type text not null check (condition_type in ('target_available','energy_threshold','cooldown_expired')),
  threshold jsonb not null default '{}',
  enabled boolean not null default true,
  quiet_hours_start text,
  quiet_hours_end text,
  created_at timestamptz not null default now()
);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  rule_id uuid references public.alert_rules(id) on delete cascade,
  message text not null,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index idx_player_observations_user_player on public.player_observations(user_id, torn_player_id);
create index idx_estimates_user_player on public.estimates(user_id, torn_player_id);
create index idx_alert_rules_user on public.alert_rules(user_id);
create index idx_notification_events_user on public.notification_events(user_id);

alter table public.player_observations enable row level security;
alter table public.estimates enable row level security;
alter table public.alert_rules enable row level security;
alter table public.notification_events enable row level security;

create policy "observations_all_own" on public.player_observations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "estimates_all_own" on public.estimates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "alert_rules_all_own" on public.alert_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "notification_events_all_own" on public.notification_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
