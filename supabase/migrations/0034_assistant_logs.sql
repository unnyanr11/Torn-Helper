-- Torn Command Center - Phase 17 assistant logs

create table public.assistant_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now()
);

create index idx_assistant_logs_user on public.assistant_logs(user_id, created_at);

alter table public.assistant_logs enable row level security;

create policy "assistant_logs_all_own" on public.assistant_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
