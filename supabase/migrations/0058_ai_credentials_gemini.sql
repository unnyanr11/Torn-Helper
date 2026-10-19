-- Torn Command Center - Phase 40b: add gemini to provider check constraint

-- Drop existing check constraint and recreate with gemini included
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'encrypted_credentials_provider_check'
  ) then
    alter table public.encrypted_credentials drop constraint encrypted_credentials_provider_check;
  end if;
end $$;

alter table public.encrypted_credentials add constraint encrypted_credentials_provider_check check (provider in ('torn','openai','gemini'));
