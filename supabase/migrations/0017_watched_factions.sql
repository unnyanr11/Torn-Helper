-- Torn Command Center - Phase 10 watched factions

create table public.watched_factions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  faction_id bigint not null,
  faction_name text not null,
  priority int not null default 1 check (priority between 1 and 30),
  refresh_interval_minutes int not null default 60 check (refresh_interval_minutes between 5 and 1440),
  paused boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, faction_id)
);

create index idx_watched_factions_user on public.watched_factions(user_id, priority);

alter table public.watched_factions enable row level security;

create policy "watched_factions_all_own" on public.watched_factions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.enforce_watch_limit()
returns trigger as $$
begin
  if (select count(*) from public.watched_factions where user_id = new.user_id) >= 30 then
    raise exception 'Watched faction limit (30) reached';
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_watch_limit
before insert on public.watched_factions
for each row execute function public.enforce_watch_limit();
