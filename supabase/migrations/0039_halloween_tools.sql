-- Torn Command Center - Phase 22 Halloween tools (spec section 7C seasonal)

create table public.halloween_candy_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  candy_type text not null check (candy_type in ('candy','chocolate','plushie','flower','other')),
  count integer not null default 0 check (count >= 0),
  source text not null default 'trick-or-treat',
  created_at timestamptz not null default now()
);

create index idx_halloween_candy_log_user on public.halloween_candy_log(user_id, created_at);

alter table public.halloween_candy_log enable row level security;
create policy "halloween_candy_log_owner_all" on public.halloween_candy_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
