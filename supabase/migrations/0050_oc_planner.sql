-- Torn Command Center - Phase 33 OC planner (spec section 9)

create table public.oc_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  oc_name text not null,
  oc_type text not null default 'standard' check (oc_type in ('standard','event')),
  status text not null default 'planning' check (status in ('planning','ready','launched','completed','cancelled')),
  slots_total int not null default 1 check (slots_total > 0),
  slots_filled int not null default 0 check (slots_filled >= 0),
  success_rate numeric not null default 0 check (success_rate >= 0 and success_rate <= 100),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.oc_slots (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.oc_plans(id) on delete cascade,
  slot_name text not null,
  required_level int not null default 1,
  assigned_member_torn_id bigint,
  assigned_member_name text,
  status text not null default 'open' check (status in ('open','filled','ready','completed')),
  created_at timestamptz not null default now()
);

create index idx_oc_plans_user on public.oc_plans(user_id, status, created_at);
create index idx_oc_slots_plan on public.oc_slots(plan_id, status);

alter table public.oc_plans enable row level security;
create policy "oc_plans_owner_all" on public.oc_plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.oc_slots enable row level security;
create policy "oc_slots_owner_all" on public.oc_slots for all using (
  exists (select 1 from public.oc_plans p where p.id = plan_id and p.user_id = auth.uid())
) with check (
  exists (select 1 from public.oc_plans p where p.id = plan_id and p.user_id = auth.uid())
);
