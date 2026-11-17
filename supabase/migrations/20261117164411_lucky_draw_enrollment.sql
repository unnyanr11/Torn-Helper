-- Enrollment records interest only. Verified transfer receipts remain the sole entry source.
create table public.lucky_draw_enrollments (
 campaign_id uuid not null references public.lucky_draw_campaigns(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 torn_id bigint not null, player_name text not null, created_at timestamptz not null default now(),
 primary key(campaign_id,user_id)
);
create index lucky_draw_enrollments_user_created on public.lucky_draw_enrollments(user_id,created_at);
alter table public.lucky_draw_enrollments enable row level security;
revoke all on public.lucky_draw_enrollments from public,anon,authenticated;
grant select on public.lucky_draw_enrollments to authenticated;
create policy enrollment_private_read on public.lucky_draw_enrollments for select to authenticated using (
 user_id=(select auth.uid()) or exists(select 1 from public.lucky_draw_campaigns c where c.id=campaign_id and c.host_user_id=(select auth.uid()))
);
create function public.enroll_lucky_draw(p_campaign uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); c public.lucky_draw_campaigns; identity_row public.linked_torn_accounts;
begin
 if actor is null then raise exception 'Sign in required'; end if;
 select * into identity_row from public.linked_torn_accounts where user_id=actor and revoked_at is null;
 if not found then raise exception 'Link a verified Torn identity before enrolling'; end if;
 perform pg_advisory_xact_lock(hashtextextended('draw-enroll:'||actor::text,0));
 select * into c from public.lucky_draw_campaigns where id=p_campaign for update;
 if not found then raise exception 'Campaign not found'; end if;
 if c.host_user_id=actor then raise exception 'Hosts cannot enroll in their own campaign'; end if;
 if exists(select 1 from public.lucky_draw_enrollments where campaign_id=p_campaign and user_id=actor) then return jsonb_build_object('enrolled',true); end if;
 if c.cancelled_at is not null or c.drawn_at is not null or (c.closes_at is not null and c.closes_at<=now()) then raise exception 'Enrollment is closed'; end if;
 if (select count(*) from public.lucky_draw_enrollments where user_id=actor and created_at>now()-interval '1 hour')>=60 then raise exception 'Enrollment limit reached. Try again later'; end if;
 -- Reuse the campaign's authoritative audience checks and verified identity rules.
 perform public.lucky_draw_action('eligibility',p_campaign,'{}'::jsonb);
 insert into public.lucky_draw_enrollments(campaign_id,user_id,torn_id,player_name) values(p_campaign,actor,identity_row.torn_id,identity_row.torn_name) on conflict do nothing;
 return jsonb_build_object('enrolled',true);
end $$;
revoke all on function public.enroll_lucky_draw(uuid) from public,anon;
grant execute on function public.enroll_lucky_draw(uuid) to authenticated;
notify pgrst,'reload schema';
