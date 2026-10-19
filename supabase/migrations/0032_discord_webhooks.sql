-- Torn Command Center - Phase 16 Discord webhooks

create table public.discord_webhooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  alliance_id uuid references public.alliances(id) on delete cascade,
  webhook_url text not null,
  label text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_discord_webhooks_user on public.discord_webhooks(user_id);

alter table public.discord_webhooks enable row level security;

create policy "discord_webhooks_all_own" on public.discord_webhooks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
