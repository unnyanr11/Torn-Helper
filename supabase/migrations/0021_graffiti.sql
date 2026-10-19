-- Torn Command Center - Phase 14 graffiti wall

create table public.graffiti_posts (
  id uuid primary key default gen_random_uuid(),
  alliance_id uuid not null references public.alliances(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) <= 500),
  pinned boolean not null default false,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.graffiti_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.graffiti_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('👍','👎','❤️','😂','😮')),
  created_at timestamptz not null default now(),
  unique (post_id, user_id, emoji)
);

create index idx_graffiti_posts_alliance on public.graffiti_posts(alliance_id, created_at);
create index idx_graffiti_reactions_post on public.graffiti_reactions(post_id);

alter table public.graffiti_posts enable row level security;
alter table public.graffiti_reactions enable row level security;

create policy "graffiti_posts_select_member" on public.graffiti_posts
  for select using (hidden = false and exists (select 1 from public.alliance_members m where m.alliance_id = alliance_id and m.user_id = auth.uid()));
create policy "graffiti_posts_insert_member" on public.graffiti_posts
  for insert with check (author_user_id = auth.uid() and exists (select 1 from public.alliance_members m where m.alliance_id = alliance_id and m.user_id = auth.uid()));
create policy "graffiti_posts_update_officer" on public.graffiti_posts
  for update using (exists (select 1 from public.alliance_members m where m.alliance_id = alliance_id and m.user_id = auth.uid() and m.role in ('officer','leader')));
create policy "graffiti_posts_delete_author_or_officer" on public.graffiti_posts
  for delete using (author_user_id = auth.uid() or exists (select 1 from public.alliance_members m where m.alliance_id = alliance_id and m.user_id = auth.uid() and m.role in ('officer','leader')));

create policy "graffiti_reactions_select_member" on public.graffiti_reactions
  for select using (exists (select 1 from public.alliance_members m where m.alliance_id = (select alliance_id from public.graffiti_posts p where p.id = post_id) and m.user_id = auth.uid()));
create policy "graffiti_reactions_insert_member" on public.graffiti_reactions
  for insert with check (user_id = auth.uid() and exists (select 1 from public.alliance_members m where m.alliance_id = (select alliance_id from public.graffiti_posts p where p.id = post_id) and m.user_id = auth.uid()));
create policy "graffiti_reactions_delete_own" on public.graffiti_reactions
  for delete using (user_id = auth.uid());
