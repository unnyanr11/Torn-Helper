-- Torn Command Center - Phase 9 alliances & families

create table public.alliances (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  tag text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.alliance_members (
  id uuid primary key default gen_random_uuid(),
  alliance_id uuid not null references public.alliances(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member','officer','leader')),
  joined_at timestamptz not null default now(),
  unique (alliance_id, user_id)
);

create table public.alliance_invitations (
  id uuid primary key default gen_random_uuid(),
  alliance_id uuid not null references public.alliances(id) on delete cascade,
  inviter_user_id uuid not null references public.profiles(id) on delete cascade,
  invitee_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  unique (alliance_id, invitee_user_id)
);

create table public.alliance_announcements (
  id uuid primary key default gen_random_uuid(),
  alliance_id uuid not null references public.alliances(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index idx_alliance_members_user on public.alliance_members(user_id);
create index idx_alliance_invitations_invitee on public.alliance_invitations(invitee_user_id, status);
create index idx_alliance_announcements_alliance on public.alliance_announcements(alliance_id, created_at);

alter table public.alliances enable row level security;
alter table public.alliance_members enable row level security;
alter table public.alliance_invitations enable row level security;
alter table public.alliance_announcements enable row level security;

create policy "alliances_select_member" on public.alliances
  for select using (exists (select 1 from public.alliance_members m where m.alliance_id = id and m.user_id = auth.uid()));
create policy "alliances_insert_any" on public.alliances
  for insert with check (auth.uid() = created_by);

create policy "alliance_members_select_member" on public.alliance_members
  for select using (exists (select 1 from public.alliance_members m2 where m2.alliance_id = alliance_id and m2.user_id = auth.uid()));
create policy "alliance_members_insert_leader" on public.alliance_members
  for insert with check (exists (select 1 from public.alliance_members m where m.alliance_id = alliance_id and m.user_id = auth.uid() and m.role in ('officer','leader')));
create policy "alliance_members_update_leader" on public.alliance_members
  for update using (exists (select 1 from public.alliance_members m where m.alliance_id = alliance_id and m.user_id = auth.uid() and m.role = 'leader'));
create policy "alliance_members_delete_self_or_leader" on public.alliance_members
  for delete using (user_id = auth.uid() or exists (select 1 from public.alliance_members m where m.alliance_id = alliance_id and m.user_id = auth.uid() and m.role = 'leader'));

create policy "alliance_invitations_select" on public.alliance_invitations
  for select using (inviter_user_id = auth.uid() or invitee_user_id = auth.uid() or exists (select 1 from public.alliance_members m where m.alliance_id = alliance_id and m.user_id = auth.uid()));
create policy "alliance_invitations_insert_officer" on public.alliance_invitations
  for insert with check (inviter_user_id = auth.uid() and exists (select 1 from public.alliance_members m where m.alliance_id = alliance_id and m.user_id = auth.uid() and m.role in ('officer','leader')));
create policy "alliance_invitations_update_invited" on public.alliance_invitations
  for update using (invitee_user_id = auth.uid() or inviter_user_id = auth.uid());

create policy "alliance_announcements_select_member" on public.alliance_announcements
  for select using (exists (select 1 from public.alliance_members m where m.alliance_id = alliance_id and m.user_id = auth.uid()));
create policy "alliance_announcements_insert_officer" on public.alliance_announcements
  for insert with check (author_user_id = auth.uid() and exists (select 1 from public.alliance_members m where m.alliance_id = alliance_id and m.user_id = auth.uid() and m.role in ('officer','leader')));
create policy "alliance_announcements_delete_author_or_leader" on public.alliance_announcements
  for delete using (author_user_id = auth.uid() or exists (select 1 from public.alliance_members m where m.alliance_id = alliance_id and m.user_id = auth.uid() and m.role = 'leader'));
