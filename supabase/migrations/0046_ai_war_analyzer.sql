-- Torn Command Center - Phase 29 AI war analyzer wiring (spec section 7C #17)

create table public.ai_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'openai',
  consented boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table public.ai_analysis_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  war_id uuid,
  provider text not null default 'openai',
  model text not null default 'gpt-4o-mini',
  status text not null default 'pending' check (status in ('pending','complete','failed')),
  prompt_hash text,
  response text,
  error_message text,
  created_at timestamptz not null default now()
);

create index idx_ai_analysis_requests_user on public.ai_analysis_requests(user_id, status, created_at);

alter table public.ai_consents enable row level security;
create policy "ai_consents_owner_all" on public.ai_consents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.ai_analysis_requests enable row level security;
create policy "ai_analysis_requests_owner_all" on public.ai_analysis_requests for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
