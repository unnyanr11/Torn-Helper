-- Torn Command Center - Phase 16 notification preferences

create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_enabled boolean not null default false,
  email_address text,
  push_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "notification_preferences_all_own" on public.notification_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
