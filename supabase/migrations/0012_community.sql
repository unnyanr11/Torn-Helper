-- Torn Command Center - Phase 5 community

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  category text not null default 'general' check (category in ('general','beginner','levelling','war','market','other')),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_community_posts_category on public.community_posts(category, created_at);

alter table public.community_posts enable row level security;

-- Anyone authenticated can read non-hidden posts
create policy "community_posts_select_public" on public.community_posts
  for select using (hidden = false);

-- Authors can insert and manage their own posts
create policy "community_posts_insert_own" on public.community_posts
  for insert with check (auth.uid() = author_user_id);
create policy "community_posts_update_own" on public.community_posts
  for update using (auth.uid() = author_user_id);
create policy "community_posts_delete_own" on public.community_posts
  for delete using (auth.uid() = author_user_id);
