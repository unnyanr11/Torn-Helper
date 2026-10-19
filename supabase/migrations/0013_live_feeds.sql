-- Torn Command Center - Phase 6 live data feeds

create table public.live_feed_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  feed_type text not null check (feed_type in ('travel','market','stocks','company')),
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  ttl_seconds int not null default 300,
  unique (user_id, feed_type)
);

create index idx_live_feed_cache_user on public.live_feed_cache(user_id, feed_type);

alter table public.live_feed_cache enable row level security;

create policy "live_feed_cache_all_own" on public.live_feed_cache
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
