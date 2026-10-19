-- Torn Command Center - Phase 1 core schema
-- Profiles, linked Torn accounts, encrypted credentials, consents,
-- feature permissions, factions, memberships, and audit events.

create extension if not exists "pgcrypto";
create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.linked_torn_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  torn_id bigint not null unique,
  torn_name text,
  key_access_level text not null check (key_access_level in ('Public Only','Minimal Access','Limited Access','Full Access','Custom')),
  linked_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, torn_id)
);

create table private.encrypted_credentials (
  id uuid primary key default gen_random_uuid(),
  linked_account_id uuid not null references public.linked_torn_accounts(id) on delete cascade,
  ciphertext bytea not null,
  key_version int not null default 1,
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  revoked_at timestamptz
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  consent_type text not null check (consent_type in ('faction_sharing','community_estimates','third_party_integration','ai_processing')),
  granted boolean not null default false,
  granted_at timestamptz,
  revoked_at timestamptz,
  unique (user_id, consent_type)
);

create table public.feature_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature text not null,
  enabled boolean not null default false,
  granted_at timestamptz not null default now(),
  unique (user_id, feature)
);

create table public.factions (
  id uuid primary key default gen_random_uuid(),
  torn_faction_id bigint not null unique,
  name text not null,
  tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  faction_id uuid not null references public.factions(id) on delete cascade,
  role text not null default 'member' check (role in ('member','officer','leader','banker')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (user_id, faction_id)
);

create table private.audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_linked_torn_accounts_user on public.linked_torn_accounts(user_id);
create index idx_memberships_user on public.memberships(user_id);
create index idx_memberships_faction on public.memberships(faction_id);
create index idx_feature_permissions_user on public.feature_permissions(user_id);
create index idx_consents_user on public.consents(user_id);
create index idx_audit_events_actor on private.audit_events(actor_user_id);
create index idx_audit_events_entity on private.audit_events(entity_type, entity_id);
