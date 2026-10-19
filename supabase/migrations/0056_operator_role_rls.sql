-- Torn Command Center - Phase 39 operator role + RLS policies

-- Add role column to profiles if not exists
alter table public.profiles add column if not exists role text not null default 'user' check (role in ('user','payment_operator','admin'));

-- RLS: payment_operator can see/update all settlement entries
create policy "loss_settlement_operator_all" on public.loss_settlement_entries
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('payment_operator','admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('payment_operator','admin')
    )
  );

-- RLS: payment_operator can see/update all disputes
create policy "loss_disputes_operator_all" on public.loss_disputes
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('payment_operator','admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('payment_operator','admin')
    )
  );

-- RLS: payment_operator can see all funding records (read-only audit)
create policy "loss_funding_operator_read" on public.loss_funding_records
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('payment_operator','admin')
    )
  );

-- RLS: payment_operator can see all attack evidence (read-only audit)
create policy "loss_evidence_operator_read" on public.loss_attack_evidence
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('payment_operator','admin')
    )
  );
