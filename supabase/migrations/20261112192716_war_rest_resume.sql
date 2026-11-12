alter table public.war_target_lists add column resting boolean not null default false;
create table public.war_rest_claims(
 user_id uuid not null references public.profiles(id) on delete cascade,
 faction_id bigint not null,war_key text not null,target_id bigint not null,target_name text not null,
 claimant_torn_id bigint not null,original_claim_id uuid not null,original_claimed_at timestamptz not null,
 attacks_goal integer not null check(attacks_goal between 1 and 100),attacks_done integer not null check(attacks_done>=0),
 rested_at timestamptz not null default now(),primary key(user_id,war_key,target_id)
);
alter table public.war_rest_claims enable row level security;
revoke all on public.war_rest_claims from public,anon,authenticated;grant select on public.war_rest_claims to authenticated;grant all on public.war_rest_claims to service_role;
create policy war_rest_owner on public.war_rest_claims for select to authenticated using(user_id=(select auth.uid()));
alter publication supabase_realtime add table public.war_rest_claims;
create function public.rest_war_targets(owner_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.war_target_claims; w public.war_target_lists; count_saved integer:=0;
begin
 select * into w from public.war_target_lists where user_id=owner_id for update;
 if not found then raise exception 'Choose your war targets first.';end if;
 for c in select * from public.war_target_claims where user_id=owner_id for update loop
  if c.attacks_goal>c.attacks_done then
   insert into public.war_rest_claims(user_id,faction_id,war_key,target_id,target_name,claimant_torn_id,original_claim_id,original_claimed_at,attacks_goal,attacks_done)
   values(owner_id,c.faction_id,c.war_key,c.target_id,coalesce((select t->>'name' from jsonb_array_elements(w.targets) t where (t->>'id')::bigint=c.target_id limit 1),c.target_id::text),c.claimant_torn_id,c.claim_id,c.claimed_at,c.attacks_goal,c.attacks_done)
   on conflict(user_id,war_key,target_id) do update set faction_id=excluded.faction_id,target_name=excluded.target_name,claimant_torn_id=excluded.claimant_torn_id,original_claim_id=excluded.original_claim_id,original_claimed_at=excluded.original_claimed_at,attacks_goal=excluded.attacks_goal,attacks_done=excluded.attacks_done,rested_at=now();
   count_saved:=count_saved+1;
  end if;
  delete from public.war_target_claims where claim_id=c.claim_id and user_id=owner_id;
 end loop;
 update public.war_target_lists set resting=true where user_id=owner_id;
 delete from private.war_claim_scans where user_id=owner_id;
 insert into public.war_events(user_id,faction_id,war_key,actor_torn_id,kind,details)
 select owner_id,w.faction_id,w.war_key,a.torn_id,'rest',jsonb_build_object('released',count_saved) from public.linked_torn_accounts a where a.user_id=owner_id and a.revoked_at is null;
 return jsonb_build_object('released',count_saved,'resting',true);
end $$;
revoke all on function public.rest_war_targets(uuid) from public,anon,authenticated;grant execute on function public.rest_war_targets(uuid) to service_role;
-- Reconcile only attacks that occurred during the original claim, never while resting.
create function public.record_rest_attacks(owner_id uuid,records jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare r public.war_rest_claims;a jsonb;added integer;
begin
 if jsonb_typeof(records)<>'array' or jsonb_array_length(records)>200 then raise exception 'Invalid attack page.';end if;
 for r in select * from public.war_rest_claims where user_id=owner_id for update loop
  for a in select value from jsonb_array_elements(records) loop
   if (a->>'attacker')::bigint=r.claimant_torn_id and (a->>'defender')::bigint=r.target_id and (a->>'started')::numeric>=extract(epoch from r.original_claimed_at) and (a->>'ended')::numeric>=extract(epoch from r.original_claimed_at) and (a->>'ended')::numeric<=extract(epoch from r.rested_at) and a->>'id' ~ '^[0-9]+$' then
    insert into private.war_claim_attacks(claim_id,attack_id) values(r.original_claim_id,a->>'id') on conflict do nothing;get diagnostics added=row_count;
    if added=1 then r.attacks_done:=least(r.attacks_goal,r.attacks_done+1);end if;
   end if;
  end loop;
  update public.war_rest_claims set attacks_done=r.attacks_done where user_id=owner_id and war_key=r.war_key and target_id=r.target_id;
 end loop;
end $$;
revoke all on function public.record_rest_attacks(uuid,jsonb) from public,anon,authenticated;grant execute on function public.record_rest_attacks(uuid,jsonb) to service_role;
create function public.resume_war_targets(owner_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare w public.war_target_lists;a public.linked_torn_accounts;r public.war_rest_claims;held public.war_target_claims;
 resumed jsonb:='[]';blocked jsonb:='[]';discarded jsonb:='[]';created uuid;reason text;
begin
 select * into w from public.war_target_lists where user_id=owner_id for update;
 if not found then raise exception 'Choose your war targets first.';end if;
 if not exists(select 1 from public.war_rest_claims where user_id=owner_id) then
  update public.war_target_lists set resting=false where user_id=owner_id;
  return jsonb_build_object('resumed',resumed,'blocked',blocked,'discarded',discarded);
 end if;
 select * into a from public.linked_torn_accounts where user_id=owner_id and revoked_at is null;
 if not found then raise exception 'Link your current Torn identity first.';end if;
 if w.active and (w.verified_until<=now() or not exists(select 1 from private.war_memberships m where m.user_id=owner_id and m.torn_id=a.torn_id and m.faction_id=w.faction_id and m.verified_until>now())) then raise exception 'Refresh faction verification first.';end if;
 for r in select * from public.war_rest_claims where user_id=owner_id for update loop
  reason:=null;
  if r.attacks_done>=r.attacks_goal then reason:='Attack goal already completed';
  elsif not w.active or r.war_key<>w.war_key or r.faction_id<>w.faction_id or r.claimant_torn_id<>a.torn_id then reason:='War or faction changed';
  elsif not(r.target_id=any(w.target_ids)) or not exists(select 1 from jsonb_array_elements(w.targets) t where (t->>'id')::bigint=r.target_id) then reason:='Target is no longer assigned or in the enemy roster';end if;
  if reason is not null then
   discarded:=discarded||jsonb_build_array(jsonb_build_object('target_id',r.target_id,'name',r.target_name,'reason',reason));
   delete from public.war_rest_claims where user_id=owner_id and war_key=r.war_key and target_id=r.target_id;continue;
  end if;
  created:=null;
  insert into public.war_target_claims(faction_id,war_key,target_id,user_id,claimant_torn_id,claimant_name,expires_at,attacks_goal,attacks_done)
  values(w.faction_id,w.war_key,r.target_id,owner_id,a.torn_id,a.torn_name,now()+interval '10 minutes',r.attacks_goal,r.attacks_done)
  on conflict(faction_id,war_key,target_id) do update set user_id=excluded.user_id,claimant_torn_id=excluded.claimant_torn_id,claimant_name=excluded.claimant_name,expires_at=excluded.expires_at,attacks_goal=excluded.attacks_goal,attacks_done=excluded.attacks_done,claimed_at=now(),claim_id=gen_random_uuid()
  where public.war_target_claims.expires_at<=now() returning claim_id into created;
  if created is null then
   select * into held from public.war_target_claims where faction_id=w.faction_id and war_key=w.war_key and target_id=r.target_id;
   blocked:=blocked||jsonb_build_array(jsonb_build_object('target_id',r.target_id,'name',r.target_name,'reason','Already claimed by '||held.claimant_name,'expires_at',held.expires_at));
  else
   resumed:=resumed||jsonb_build_array(jsonb_build_object('target_id',r.target_id,'name',r.target_name,'remaining',r.attacks_goal-r.attacks_done));
   delete from public.war_rest_claims where user_id=owner_id and war_key=r.war_key and target_id=r.target_id;
  end if;
 end loop;
 update public.war_target_lists set resting=false where user_id=owner_id;
 delete from private.war_claim_scans where user_id=owner_id;
 insert into public.war_events(user_id,faction_id,war_key,actor_torn_id,kind,details) values(owner_id,w.faction_id,w.war_key,a.torn_id,'return',jsonb_build_object('resumed',resumed,'blocked',blocked,'discarded',discarded));
 return jsonb_build_object('resumed',resumed,'blocked',blocked,'discarded',discarded);
end $$;
revoke all on function public.resume_war_targets(uuid) from public,anon,authenticated;grant execute on function public.resume_war_targets(uuid) to service_role;

-- Serialize a new claim against the rest transition.
create or replace function public.take_war_target(owner_id uuid,target bigint,attack_goal integer default 1) returns jsonb language plpgsql security invoker set search_path='' as $$
declare w public.war_target_lists; a public.linked_torn_accounts; result public.war_target_claims;
begin
 if attack_goal is null or attack_goal<1 or attack_goal>100 then raise exception 'Choose between 1 and 100 attacks.';end if;
 select * into w from public.war_target_lists where user_id=owner_id and active and not resting and verified_until>now() and target=any(target_ids) for update;
 if not found then raise exception 'Refresh your assigned targets first.';end if;
 select * into a from public.linked_torn_accounts where user_id=owner_id and revoked_at is null;
 if not found or not exists(select 1 from private.war_memberships m where m.user_id=owner_id and m.faction_id=w.faction_id and m.torn_id=a.torn_id and m.verified_until>now()) then raise exception 'Refresh faction verification first.';end if;
 insert into public.war_target_claims(faction_id,war_key,target_id,user_id,claimant_torn_id,claimant_name,expires_at,attacks_goal) values(w.faction_id,w.war_key,target,owner_id,a.torn_id,a.torn_name,now()+interval '10 minutes',attack_goal)
 on conflict(faction_id,war_key,target_id) do update set user_id=excluded.user_id,claimant_torn_id=excluded.claimant_torn_id,claimant_name=excluded.claimant_name,expires_at=excluded.expires_at,attacks_goal=excluded.attacks_goal,attacks_done=0,claimed_at=now(),claim_id=gen_random_uuid() where public.war_target_claims.expires_at<=now() or public.war_target_claims.user_id=owner_id returning * into result;
 if not found then raise exception 'Another member already claimed this target.';end if;
 delete from public.war_rest_claims where user_id=owner_id and war_key=w.war_key and target_id=target;
 insert into public.war_events(user_id,faction_id,war_key,actor_torn_id,kind,details) values(owner_id,w.faction_id,w.war_key,a.torn_id,'claim',jsonb_build_object('target_id',target,'expires_at',result.expires_at));
 return to_jsonb(result);
end $$;
revoke all on function public.take_war_target(uuid,bigint,integer) from public,anon,authenticated;grant execute on function public.take_war_target(uuid,bigint,integer) to service_role;
