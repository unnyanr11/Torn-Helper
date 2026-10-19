-- Torn Command Center - Phase 40 AI credentials (user-supplied OpenAI key)

-- Add provider column to encrypted_credentials to distinguish Torn vs OpenAI keys
alter table public.encrypted_credentials add column if not exists provider text not null default 'torn' check (provider in ('torn','openai'));

-- Index for quick lookup by user + provider
create index if not exists idx_encrypted_credentials_user_provider on public.encrypted_credentials(user_id, provider);

-- RLS: users can only see/manage their own credentials (existing policy should already cover this, but ensure it)
-- (Assuming existing policy "encrypted_credentials_owner_all" exists; if not, add it)
