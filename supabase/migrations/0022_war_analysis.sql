-- Torn Command Center - Phase 14 AI war analyzer

alter table public.wars
  add column if not exists analysis jsonb;
