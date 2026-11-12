-- Coordination writes are short transactions, serialized to keep swaps, rest,
-- overrides, progress completion and ordinary claims consistent with each other.
create function private.lock_war_claims() returns void language sql volatile security invoker set search_path='' as $$ select pg_advisory_xact_lock(57234127) $$;
revoke all on function private.lock_war_claims() from public,anon,authenticated;grant execute on function private.lock_war_claims() to service_role;
create table public.war_handlers(faction_id bigint not null,war_key text not null,torn_id bigint not null,appointed_by bigint not null,created_at timestamptz not null default now(),primary key(faction_id,war_key,torn_id));
create table public.war_claim_policies(faction_id bigint not null,war_key text not null,max_attacks integer not null default 3 check(max_attacks between 1 and 100),primary key(faction_id,war_key));
create table public.war_target_rules(faction_id bigint not null,war_key text not null,target_id bigint not null,assignee_id bigint not null,reason text not null,updated_by bigint not null,primary key(faction_id,war_key,target_id));
create table public.war_wait_queue(id bigint generated always as identity primary key,faction_id bigint not null,war_key text not null,target_id bigint not null,user_id uuid not null references public.profiles(id) on delete cascade,torn_id bigint not null,player_name text not null,attacks_goal integer not null default 1 check(attacks_goal between 1 and 100),resume_goal boolean not null default false,queued_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '30 minutes',offer_until timestamptz,unique(faction_id,war_key,target_id,user_id));
create index war_wait_queue_owner on public.war_wait_queue(user_id);
create index war_wait_queue_turn on public.war_wait_queue(faction_id,war_key,target_id,id);
create table public.war_transfer_requests(id uuid primary key default gen_random_uuid(),faction_id bigint not null,war_key text not null,requester uuid not null references public.profiles(id) on delete cascade,holder uuid not null references public.profiles(id) on delete cascade,claim_id uuid not null,target_id bigint not null,swap_claim_id uuid,swap_target_id bigint,state text not null default 'pending' check(state in ('pending','accepted','declined','cancelled','stale')),created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '5 minutes');
create index war_transfer_requester on public.war_transfer_requests(requester,state);
create index war_transfer_holder on public.war_transfer_requests(holder,state);
create table private.war_command_proofs(user_id uuid primary key references public.profiles(id) on delete cascade,faction_id bigint not null,war_key text not null,torn_id bigint not null,leader_id bigint not null,roster_ids bigint[] not null,enemy_id bigint not null,enemy_targets jsonb not null,war_start bigint not null,verified_until timestamptz not null);
alter table private.war_command_proofs enable row level security;revoke all on private.war_command_proofs from public,anon,authenticated;grant all on private.war_command_proofs to service_role;
alter table public.war_handlers enable row level security;
revoke all on public.war_handlers from public,anon,authenticated;grant select on public.war_handlers to authenticated;grant all on public.war_handlers to service_role;
create policy war_handlers_faction_read on public.war_handlers for select to authenticated using(private.can_read_war_faction(faction_id));
alter table public.war_claim_policies enable row level security;
revoke all on public.war_claim_policies from public,anon,authenticated;grant select on public.war_claim_policies to authenticated;grant all on public.war_claim_policies to service_role;
create policy war_claim_policies_faction_read on public.war_claim_policies for select to authenticated using(private.can_read_war_faction(faction_id));
alter table public.war_target_rules enable row level security;
revoke all on public.war_target_rules from public,anon,authenticated;grant select on public.war_target_rules to authenticated;grant all on public.war_target_rules to service_role;
create policy war_target_rules_faction_read on public.war_target_rules for select to authenticated using(private.can_read_war_faction(faction_id));
alter table public.war_wait_queue enable row level security;
revoke all on public.war_wait_queue from public,anon,authenticated;grant select on public.war_wait_queue to authenticated;grant all on public.war_wait_queue to service_role;
create policy war_wait_queue_faction_read on public.war_wait_queue for select to authenticated using(private.can_read_war_faction(faction_id));
alter table public.war_transfer_requests enable row level security;
revoke all on public.war_transfer_requests from public,anon,authenticated;grant select on public.war_transfer_requests to authenticated;grant all on public.war_transfer_requests to service_role;
create policy war_transfers_parties on public.war_transfer_requests for select to authenticated using(requester=(select auth.uid()) or holder=(select auth.uid()));
grant usage,select on sequence public.war_wait_queue_id_seq to service_role;
create table private.war_leadership(faction_id bigint not null,war_key text not null,leader_id bigint not null,primary key(faction_id,war_key));
alter table private.war_leadership enable row level security;revoke all on private.war_leadership from public,anon,authenticated;grant all on private.war_leadership to service_role;
create function public.verify_war_command(owner_id uuid,faction bigint,war text,identity bigint,leader bigint,roster bigint[],enemy bigint,targets jsonb,started bigint) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform private.lock_war_claims();
 if exists(select 1 from private.war_leadership where faction_id=faction and war_key=war and leader_id<>leader) then
  perform private.war_notice(a.user_id,'Faction leadership changed; your previous war-handler appointment ended.') from public.war_handlers h join public.linked_torn_accounts a on a.torn_id=h.torn_id where h.faction_id=faction and h.war_key=war and a.revoked_at is null;
  delete from public.war_handlers where faction_id=faction and war_key=war;
 end if;
 delete from public.war_handlers where faction_id=faction and war_key=war and not(torn_id=any(roster));
 insert into private.war_leadership values(faction,war,leader) on conflict(faction_id,war_key) do update set leader_id=excluded.leader_id;
 if not(identity=any(roster)) or not exists(select 1 from public.linked_torn_accounts where user_id=owner_id and torn_id=identity and revoked_at is null) then raise exception 'Current faction membership required.';end if;
 insert into private.war_command_proofs values(owner_id,faction,war,identity,leader,roster,enemy,targets,started,now()+interval '2 minutes') on conflict(user_id) do update set faction_id=excluded.faction_id,war_key=excluded.war_key,torn_id=excluded.torn_id,leader_id=excluded.leader_id,roster_ids=excluded.roster_ids,enemy_id=excluded.enemy_id,enemy_targets=excluded.enemy_targets,war_start=excluded.war_start,verified_until=excluded.verified_until;
 perform public.verify_war_membership(owner_id,faction,identity);
end $$;
create function private.war_proof(owner_id uuid) returns private.war_command_proofs language plpgsql stable security invoker set search_path='' as $$
declare p private.war_command_proofs;
begin
 select * into p from private.war_command_proofs where user_id=owner_id and verified_until>now();
 if not found or not exists(select 1 from public.linked_torn_accounts where user_id=owner_id and torn_id=p.torn_id and revoked_at is null) then raise exception 'Refresh current war and role verification first.';end if;
 return p;
end $$;
create function private.war_manager(p private.war_command_proofs) returns boolean language sql stable security invoker set search_path='' as $$
 select p.torn_id=any(p.roster_ids) and (p.torn_id=p.leader_id or exists(select 1 from public.war_handlers h where h.faction_id=p.faction_id and h.war_key=p.war_key and h.torn_id=p.torn_id and h.appointed_by=p.leader_id))
$$;
create function private.war_notice(owner_id uuid,message text) returns void language sql security invoker set search_path='' as $$ insert into public.notifications(user_id,title,body) values(owner_id,'War coordination',left(message,1500)) $$;
create function private.queue_head(faction bigint,war text,target bigint) returns public.war_wait_queue language plpgsql security invoker set search_path='' as $$
declare q public.war_wait_queue;
begin
 delete from public.war_wait_queue x where x.faction_id=faction and x.war_key=war and x.target_id=target and (x.expires_at<=now() or not exists(select 1 from public.war_target_lists w join public.linked_torn_accounts a on a.user_id=w.user_id where w.user_id=x.user_id and w.faction_id=faction and w.war_key=war and w.active and not w.resting and target=any(w.target_ids) and a.torn_id=x.torn_id and a.revoked_at is null));
 if exists(select 1 from public.war_target_rules where faction_id=faction and war_key=war and target_id=target) then return null;end if;
 if exists(select 1 from public.war_target_claims where faction_id=faction and war_key=war and target_id=target and expires_at>now()) then return null;end if;
 loop
  select * into q from public.war_wait_queue where faction_id=faction and war_key=war and target_id=target order by id limit 1 for update;
  if not found then return null;end if;
  if q.offer_until is not null and q.offer_until<=now() then
   perform private.war_notice(q.user_id,'Your 60-second turn for target '||target||' expired. Join again to wait at the back.');delete from public.war_wait_queue where id=q.id;continue;
  end if;
  if q.offer_until is null then
   update public.war_wait_queue set offer_until=now()+interval '60 seconds' where id=q.id returning * into q;
   perform private.war_notice(q.user_id,'Your turn for target '||target||'. Confirm the claim within 60 seconds.');
  end if;
  return q;
 end loop;
end $$;
-- Taking a target is FCFS, with one active reservation per member and a short
-- exclusive acceptance window for the head of an already-existing queue.
create or replace function public.take_war_target(owner_id uuid,target bigint,attack_goal integer default 1) returns jsonb language plpgsql security invoker set search_path='' as $$
declare w public.war_target_lists;a public.linked_torn_accounts;c public.war_target_claims;q public.war_wait_queue;r public.war_rest_claims;limit_hits integer;assigned bigint;goal integer:=attack_goal;done integer:=0;
begin
 perform private.lock_war_claims();
 if attack_goal is null or attack_goal<1 or attack_goal>100 then raise exception 'Choose between 1 and 100 attacks.';end if;
 select * into w from public.war_target_lists where user_id=owner_id and active and not resting and verified_until>now() and target=any(target_ids) for update;
 if not found then raise exception 'Refresh your assigned targets first.';end if;
 select * into a from public.linked_torn_accounts where user_id=owner_id and revoked_at is null;
 if not found or not exists(select 1 from private.war_memberships m where m.user_id=owner_id and m.faction_id=w.faction_id and m.torn_id=a.torn_id and m.verified_until>now()) then raise exception 'Refresh faction verification first.';end if;
 if exists(select 1 from public.war_target_claims where user_id=owner_id and expires_at>now()) then raise exception 'Release or finish your one active reservation first.';end if;
 select assignee_id into assigned from public.war_target_rules where faction_id=w.faction_id and war_key=w.war_key and target_id=target;
 if assigned is not null and assigned<>a.torn_id then raise exception 'Leadership assigned this target to another member.';end if;
 if exists(select 1 from public.war_target_claims where faction_id=w.faction_id and war_key=w.war_key and target_id=target and expires_at>now()) then raise exception 'Another member already claimed this target. Join the queue or request a transfer.';end if;
 q:=private.queue_head(w.faction_id,w.war_key,target);
 if q.id is not null and q.user_id<>owner_id then return jsonb_build_object('error','A queued member has the next turn. Join the queue.');end if;
 limit_hits:=coalesce((select max_attacks from public.war_claim_policies where faction_id=w.faction_id and war_key=w.war_key),3);
 if q.id is not null and q.resume_goal then
  select * into r from public.war_rest_claims where user_id=owner_id and war_key=w.war_key and target_id=target;
  if not found then raise exception 'Saved rest goal changed. Return again before claiming.';end if;
  goal:=r.attacks_goal;done:=r.attacks_done;
 elsif goal is null or goal<1 or goal>limit_hits then raise exception 'Choose between 1 and % attacks under this war policy.',limit_hits;end if;
 if goal<=done then raise exception 'This goal is already complete.';end if;
 insert into public.war_target_claims(faction_id,war_key,target_id,user_id,claimant_torn_id,claimant_name,expires_at,attacks_goal,attacks_done) values(w.faction_id,w.war_key,target,owner_id,a.torn_id,a.torn_name,now()+interval '10 minutes',goal,done)
 on conflict(faction_id,war_key,target_id) do update set user_id=excluded.user_id,claimant_torn_id=excluded.claimant_torn_id,claimant_name=excluded.claimant_name,expires_at=excluded.expires_at,attacks_goal=excluded.attacks_goal,attacks_done=excluded.attacks_done,claim_id=gen_random_uuid(),claimed_at=now() returning * into c;
 delete from public.war_wait_queue where user_id=owner_id and faction_id=w.faction_id and war_key=w.war_key and target_id=target;
 delete from public.war_rest_claims where user_id=owner_id and war_key=w.war_key and target_id=target;
 insert into public.war_events(user_id,faction_id,war_key,actor_torn_id,kind,details) values(owner_id,w.faction_id,w.war_key,a.torn_id,'claim',jsonb_build_object('target_id',target,'goal',goal,'completed',done));
 return to_jsonb(c);
end $$;
-- Only the authenticated parties can propose and accept; leadership uses a
-- separate reasoned override action, never a forged acceptance.
create function public.war_governance(owner_id uuid,command text,body jsonb default '{}') returns jsonb language plpgsql security invoker set search_path='' as $$
declare p private.war_command_proofs;w public.war_target_lists;other public.linked_torn_accounts;c public.war_target_claims;s public.war_target_claims;v public.war_transfer_requests;q public.war_wait_queue;target bigint;decision_reason text;manager boolean;leader boolean;goal integer;recipient uuid;limit_hits integer;target_json jsonb;extra jsonb;
begin
 perform private.lock_war_claims();
 if command='leave_queue' then delete from public.war_wait_queue where user_id=owner_id and target_id=(body->>'target_id')::bigint;return jsonb_build_object('left',true);end if;
 if command='respond' and coalesce((body->>'accept')::boolean,false)=false then
  update public.war_transfer_requests set state=case when requester=owner_id then 'cancelled' else 'declined' end where id=(body->>'request_id')::uuid and state='pending' and (requester=owner_id or holder=owner_id) returning * into v;
  if not found then raise exception 'This request is no longer pending.';end if;
  perform private.war_notice(case when v.requester=owner_id then v.holder else v.requester end,'Transfer request for target '||v.target_id||' was '||v.state||'.');return jsonb_build_object('state',v.state);
 end if;
 if command='snapshot' then
  select * into p from private.war_command_proofs where user_id=owner_id;
  if not found or not exists(select 1 from public.war_target_lists x join public.linked_torn_accounts a on a.user_id=x.user_id where x.user_id=owner_id and x.faction_id=p.faction_id and x.war_key=p.war_key and x.active and x.verified_until>now() and a.torn_id=p.torn_id and a.revoked_at is null) then raise exception 'Refresh current war and role verification first.';end if;
  manager:=p.verified_until>now() and private.war_manager(p);leader:=p.verified_until>now() and p.torn_id=p.leader_id;
 else p:=private.war_proof(owner_id);manager:=private.war_manager(p);leader:=p.torn_id=p.leader_id;end if;
 select * into w from public.war_target_lists where user_id=owner_id;
 limit_hits:=coalesce((select max_attacks from public.war_claim_policies where faction_id=p.faction_id and war_key=p.war_key),3);
 if command='snapshot' then
  for target in select distinct target_id from public.war_wait_queue where faction_id=p.faction_id and war_key=p.war_key loop perform private.queue_head(p.faction_id,p.war_key,target);end loop;
  return jsonb_build_object('faction_id',p.faction_id,'war_key',p.war_key,'is_leader',leader,'can_manage',manager,'leader_id',p.leader_id,'actor_id',p.torn_id,'enemies',p.enemy_targets,'max_attacks',limit_hits,'members',coalesce((select jsonb_agg(jsonb_build_object('id',a.torn_id,'name',a.torn_name)) from public.linked_torn_accounts a where a.torn_id=any(p.roster_ids) and a.revoked_at is null),'[]'),
   'handlers',coalesce((select jsonb_agg(to_jsonb(h)) from public.war_handlers h where h.faction_id=p.faction_id and h.war_key=p.war_key and h.appointed_by=p.leader_id and h.torn_id=any(p.roster_ids)),'[]'),
   'rules',coalesce((select jsonb_agg(to_jsonb(r)) from public.war_target_rules r where r.faction_id=p.faction_id and r.war_key=p.war_key),'[]'),
   'queue',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.war_wait_queue x where x.faction_id=p.faction_id and x.war_key=p.war_key and x.expires_at>now()),'[]'),
   'requests',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from public.war_transfer_requests x where x.faction_id=p.faction_id and x.war_key=p.war_key and (x.requester=owner_id or x.holder=owner_id) and x.state='pending' and x.expires_at>now()),'[]'),
   'notices',coalesce((select jsonb_agg(n) from (select n0.title,n0.body,n0.created_at from public.notifications n0 where n0.user_id=owner_id and n0.title='War coordination' order by n0.created_at desc limit 10)n),'[]'));
 end if;
 target:=nullif(body->>'target_id','')::bigint;
 decision_reason:=left(trim(coalesce(body->>'reason','')),500);
 if command in ('queue','propose','rule') and (target is null or target<=0) then raise exception 'Choose a target.';end if;
 if command in ('handler','policy') then
  if not leader then raise exception 'Only the current faction leader can appoint handlers or change claim limits.';end if;
  if command='handler' then
   if (body->>'enabled')::boolean then
    if not((body->>'member_id')::bigint=any(p.roster_ids)) or (body->>'member_id')::bigint=p.leader_id then raise exception 'Choose another current faction member.';end if;
    select * into other from public.linked_torn_accounts where torn_id=(body->>'member_id')::bigint and revoked_at is null;
    if not found then raise exception 'This member must link their Torn account first.';end if;
    insert into public.war_handlers values(p.faction_id,p.war_key,other.torn_id,p.leader_id,now()) on conflict(faction_id,war_key,torn_id) do update set appointed_by=excluded.appointed_by,created_at=now();
    perform private.war_notice(other.user_id,'You were appointed war handler for '||p.war_key||'.');
   else
    delete from public.war_handlers where faction_id=p.faction_id and war_key=p.war_key and torn_id=(body->>'member_id')::bigint;
    if found then
     select * into other from public.linked_torn_accounts where torn_id=(body->>'member_id')::bigint;
     if found then perform private.war_notice(other.user_id,'Your war-handler appointment was removed for '||p.war_key||'.');end if;
    end if;
   end if;
  else
   goal:=(body->>'max_attacks')::integer;if goal is null or goal<1 or goal>100 then raise exception 'Choose a claim limit from 1 to 100.';end if;
   insert into public.war_claim_policies values(p.faction_id,p.war_key,goal) on conflict(faction_id,war_key) do update set max_attacks=excluded.max_attacks;
  end if;
  insert into public.war_events(user_id,faction_id,war_key,actor_torn_id,kind,details) values(owner_id,p.faction_id,p.war_key,p.torn_id,command,body);return jsonb_build_object('saved',true);
 end if;
 if command='queue' then
  goal:=coalesce((body->>'attacks_goal')::integer,1);
  if w.user_id is null or not w.active or w.resting or w.war_key<>p.war_key or w.faction_id<>p.faction_id or not(target=any(w.target_ids)) then raise exception 'Choose a target from your current active shortlist.';end if;
  if goal<1 or goal>limit_hits then raise exception 'Claim goal exceeds this war limit.';end if;
  if exists(select 1 from public.war_target_rules where faction_id=p.faction_id and war_key=p.war_key and target_id=target) then raise exception 'Leadership-assigned targets do not use the public queue.';end if;
  if not exists(select 1 from jsonb_array_elements(p.enemy_targets) t where (t->>'id')::bigint=target) then raise exception 'Target left the enemy roster.';end if;
  if exists(select 1 from public.war_target_claims where user_id=owner_id and target_id=target and expires_at>now()) then raise exception 'You already hold this target.';end if;
  insert into public.war_wait_queue(faction_id,war_key,target_id,user_id,torn_id,player_name,attacks_goal) select p.faction_id,p.war_key,target,owner_id,p.torn_id,a.torn_name,goal from public.linked_torn_accounts a where a.user_id=owner_id on conflict(faction_id,war_key,target_id,user_id) do nothing;
  perform private.queue_head(p.faction_id,p.war_key,target);return jsonb_build_object('queued',true);
 end if;
 if command='propose' then
  if (select count(*) from public.war_transfer_requests where requester=owner_id and state='pending' and expires_at>now())>=5 then raise exception 'Finish or cancel a pending request first (maximum five).';end if;
  if w.user_id is null or not w.active or w.resting or w.war_key<>p.war_key or not(target=any(w.target_ids)) then raise exception 'Shortlist this target before requesting it.';end if;
  select * into c from public.war_target_claims where faction_id=p.faction_id and war_key=p.war_key and target_id=target and expires_at>now();
  if not found or c.user_id=owner_id or not(c.claimant_torn_id=any(p.roster_ids)) then raise exception 'Choose another current member’s live claim.';end if;
  select * into s from public.war_target_claims where user_id=owner_id and expires_at>now();
  if found and coalesce((body->>'swap')::boolean,false)=false then raise exception 'You already have a reservation. Choose a swap or release it first.';end if;
  if s.claim_id is not null and (s.faction_id<>p.faction_id or s.war_key<>p.war_key) then raise exception 'Both swap targets must be in this war.';end if;
  if exists(select 1 from public.war_transfer_requests where requester=owner_id and claim_id=c.claim_id and state='pending' and expires_at>now()) then raise exception 'Your request for this claim is already pending.';end if;
  insert into public.war_transfer_requests(faction_id,war_key,requester,holder,claim_id,target_id,swap_claim_id,swap_target_id) values(p.faction_id,p.war_key,owner_id,c.user_id,c.claim_id,target,s.claim_id,s.target_id) returning * into v;
  perform private.war_notice(c.user_id,'Member ['||p.torn_id||'] requests '||case when s.claim_id is null then 'a transfer' else 'a mutual swap' end||' for target '||target||'. Accept or decline in War Room.');return to_jsonb(v);
 end if;
 if command='respond' then
  select * into v from public.war_transfer_requests where id=(body->>'request_id')::uuid and holder=owner_id and state='pending' and expires_at>now() for update;
  if not found or v.faction_id<>p.faction_id or v.war_key<>p.war_key then raise exception 'Request expired or belongs to another war.';end if;
  perform 1 from public.war_target_lists where user_id in(owner_id,v.requester) order by user_id for update;
  select * into c from public.war_target_claims where claim_id=v.claim_id and user_id=owner_id and expires_at>now() for update;
  select * into other from public.linked_torn_accounts where user_id=v.requester and revoked_at is null;
  if c.claim_id is null or other.torn_id is null or not(other.torn_id=any(p.roster_ids)) then raise exception 'Claim or faction membership changed. Request is no longer valid.';end if;
  if not exists(select 1 from public.war_target_lists where user_id=v.requester and active and not resting and faction_id=p.faction_id and war_key=p.war_key and c.target_id=any(target_ids)) then raise exception 'Requester is resting or no longer shortlists this target.';end if;
  if exists(select 1 from public.war_target_rules where faction_id=p.faction_id and war_key=p.war_key and target_id=c.target_id and assignee_id<>other.torn_id) then raise exception 'Leadership assignment prevents this transfer.';end if;
  if not exists(select 1 from jsonb_array_elements(p.enemy_targets) t where (t->>'id')::bigint=c.target_id) then raise exception 'Target left the enemy roster.';end if;
  if v.swap_claim_id is null then
   if exists(select 1 from public.war_target_claims where user_id=v.requester and expires_at>now()) then raise exception 'Requester already holds another reservation.';end if;
  else
   select * into s from public.war_target_claims where claim_id=v.swap_claim_id and user_id=v.requester and expires_at>now() for update;
   if s.claim_id is null or not exists(select 1 from jsonb_array_elements(p.enemy_targets) t where (t->>'id')::bigint=s.target_id) then raise exception 'Swap claim changed or target left the enemy roster.';end if;
   if exists(select 1 from public.war_target_rules where faction_id=p.faction_id and war_key=p.war_key and target_id=s.target_id and assignee_id<>p.torn_id) then raise exception 'Leadership assignment prevents this swap.';end if;
   update public.war_target_claims set user_id=v.requester,claimant_torn_id=other.torn_id,claimant_name=other.torn_name,attacks_goal=least(limit_hits,greatest(1,attacks_goal-attacks_done)),attacks_done=0,claim_id=gen_random_uuid(),claimed_at=now(),expires_at=now()+interval '10 minutes' where claim_id=c.claim_id;
   -- Both members keep a shortlist; swap the outgoing ID only when space is needed.
   update public.war_target_lists set target_ids=case when s.target_id=any(target_ids) then target_ids when cardinality(target_ids)<100 then array_append(target_ids,s.target_id) else array_append(array_remove(target_ids,c.target_id),s.target_id) end,targets=(select coalesce(jsonb_agg(t),'[]') from jsonb_array_elements(p.enemy_targets)t where (t->>'id')::bigint=any(array_append(w.target_ids,s.target_id))),revision=revision+1 where user_id=owner_id;
   update public.war_target_claims set user_id=owner_id,claimant_torn_id=p.torn_id,claimant_name=(select torn_name from public.linked_torn_accounts where user_id=owner_id),attacks_goal=least(limit_hits,greatest(1,attacks_goal-attacks_done)),attacks_done=0,claim_id=gen_random_uuid(),claimed_at=now(),expires_at=now()+interval '10 minutes' where claim_id=s.claim_id;
  end if;
  if v.swap_claim_id is null then update public.war_target_claims set user_id=v.requester,claimant_torn_id=other.torn_id,claimant_name=other.torn_name,attacks_goal=least(limit_hits,greatest(1,attacks_goal-attacks_done)),attacks_done=0,claim_id=gen_random_uuid(),claimed_at=now(),expires_at=now()+interval '10 minutes' where claim_id=c.claim_id; end if;
  update public.war_transfer_requests set state='accepted' where id=v.id;
  delete from public.war_wait_queue where user_id in(owner_id,v.requester) and faction_id=p.faction_id and war_key=p.war_key and target_id in(v.target_id,v.swap_target_id);
  perform private.war_notice(v.requester,'Your mutually agreed transfer/swap for target '||v.target_id||' was accepted.');perform private.war_notice(owner_id,'You accepted the transfer/swap for target '||v.target_id||'.');
  insert into public.war_events(user_id,faction_id,war_key,actor_torn_id,kind,details) values(owner_id,p.faction_id,p.war_key,p.torn_id,'mutual_transfer',jsonb_build_object('request_id',v.id,'target_id',v.target_id,'swap_target_id',v.swap_target_id));
  insert into public.war_events(user_id,faction_id,war_key,actor_torn_id,kind,details) values(v.requester,p.faction_id,p.war_key,p.torn_id,'mutual_transfer',jsonb_build_object('request_id',v.id,'target_id',v.target_id,'swap_target_id',v.swap_target_id));return jsonb_build_object('accepted',true);
 end if;
 if command='rule' then
  if not manager then raise exception 'Only the current leader or their appointed war handler can assign targets.';end if;
  if length(decision_reason)<3 then raise exception 'Record a decision_reason for this leadership decision.';end if;
  select value into target_json from jsonb_array_elements(p.enemy_targets) where (value->>'id')::bigint=target;
  if target_json is null then raise exception 'Choose a current enemy target.';end if;
  if body->>'mode'='open' then
   select a.* into other from public.linked_torn_accounts a join public.war_target_rules r on r.assignee_id=a.torn_id where r.faction_id=p.faction_id and r.war_key=p.war_key and r.target_id=target and a.revoked_at is null;
   if found then perform private.war_notice(other.user_id,'Leadership returned target '||target||' to first-come mode. Reason: '||decision_reason);end if;
   delete from public.war_target_rules where faction_id=p.faction_id and war_key=p.war_key and target_id=target;
  elsif body->>'mode'='assigned' then
   select * into other from public.linked_torn_accounts where torn_id=(body->>'member_id')::bigint and revoked_at is null;
   if not found or not(other.torn_id=any(p.roster_ids)) then raise exception 'Choose a linked current faction member.';end if;
   select * into c from public.war_target_claims where faction_id=p.faction_id and war_key=p.war_key and target_id=target and expires_at>now();
   if c.claim_id is not null and c.user_id<>other.user_id and coalesce((body->>'override')::boolean,false)=false then raise exception 'This target has a live claim. Use an explicit reasoned override.';end if;
   if c.claim_id is not null and c.user_id<>other.user_id then
    delete from public.war_target_claims where claim_id=c.claim_id;
    perform private.war_notice(c.user_id,'Leadership released your claim on target '||target||'. Reason: '||decision_reason);
   end if;
   if exists(select 1 from public.war_target_lists where user_id=other.user_id and (faction_id<>p.faction_id or war_key<>p.war_key)) and coalesce((body->>'override')::boolean,false)=false then raise exception 'Member has a different war list. Confirm an override to replace it.';end if;
   if exists(select 1 from public.war_target_lists where user_id=other.user_id and faction_id=p.faction_id and war_key=p.war_key and cardinality(target_ids)>=100 and not(target=any(target_ids))) then raise exception 'Member shortlist is full. Remove a target before assigning another.';end if;
   insert into public.war_target_lists(user_id,faction_id,war_key,enemy_faction_id,target_ids,targets,active,updated_by,verified_until,war_start)
   values(other.user_id,p.faction_id,p.war_key,p.enemy_id,array[target],jsonb_build_array(target_json),true,p.torn_id,now()+interval '2 minutes',p.war_start)
   on conflict(user_id) do update set faction_id=excluded.faction_id,war_key=excluded.war_key,enemy_faction_id=excluded.enemy_faction_id,target_ids=case when public.war_target_lists.war_key=p.war_key and public.war_target_lists.faction_id=p.faction_id then (select array_agg(distinct x) from unnest(array_append(public.war_target_lists.target_ids,target))x) else array[target] end,targets=case when public.war_target_lists.war_key=p.war_key then (select coalesce(jsonb_agg(t),'[]') from jsonb_array_elements(public.war_target_lists.targets)t where (t->>'id')::bigint<>target)||jsonb_build_array(target_json) else jsonb_build_array(target_json) end,active=true,war_start=p.war_start,war_end=null,updated_by=p.torn_id,verified_until=now()+interval '2 minutes',revision=public.war_target_lists.revision+1;
   perform private.war_notice(a.user_id,'Leadership reassigned target '||target||'. Reason: '||decision_reason) from public.linked_torn_accounts a join public.war_target_rules r on r.assignee_id=a.torn_id where r.faction_id=p.faction_id and r.war_key=p.war_key and r.target_id=target and a.torn_id<>other.torn_id and a.revoked_at is null;
   insert into public.war_target_rules values(p.faction_id,p.war_key,target,other.torn_id,decision_reason,p.torn_id) on conflict(faction_id,war_key,target_id) do update set assignee_id=excluded.assignee_id,reason=excluded.reason,updated_by=excluded.updated_by;
   delete from public.war_wait_queue where faction_id=p.faction_id and war_key=p.war_key and target_id=target;
   perform private.war_notice(other.user_id,'Leadership assigned target '||target||' to you. Claim it when ready. Reason: '||decision_reason);
  else raise exception 'Choose first-come or leadership-assigned mode.';end if;
  insert into public.war_events(user_id,faction_id,war_key,actor_torn_id,kind,details) values(owner_id,p.faction_id,p.war_key,p.torn_id,'leadership_decision',body||jsonb_build_object('previous_holder',c.claimant_torn_id,'released_claim_id',c.claim_id));return jsonb_build_object('saved',true);
 end if;
 raise exception 'Unknown coordination action.';
end $$;
create function public.commit_war_assignments(owner_id uuid,actor_user uuid,values_json jsonb,expected_revision bigint default null,reason text default '') returns jsonb language plpgsql security invoker set search_path='' as $$
declare p private.war_command_proofs;w public.war_target_lists;member bigint;ids bigint[];payload jsonb;result public.war_target_lists;
begin
 perform private.lock_war_claims();p:=private.war_proof(actor_user);
 select torn_id into member from public.linked_torn_accounts where user_id=owner_id and revoked_at is null;
 if member is null or not(member=any(p.roster_ids)) then raise exception 'Assignee is not in the current faction roster.';end if;
 if owner_id<>actor_user and (not private.war_manager(p) or length(trim(reason))<3) then raise exception 'A verified leader/war handler and a recorded reason are required to edit another member.';end if;
 if (values_json->>'faction_id')::bigint<>p.faction_id or values_json->>'war_key'<>p.war_key then raise exception 'War verification does not match this assignment.';end if;
 select array_agg(x::bigint) into ids from jsonb_array_elements_text(values_json->'target_ids')x;ids:=coalesce(ids,'{}');
 if cardinality(ids)>100 or exists(select 1 from unnest(ids)i where not exists(select 1 from jsonb_array_elements(p.enemy_targets)t where (t->>'id')::bigint=i)) then raise exception 'Choose current enemy targets.';end if;
 select * into w from public.war_target_lists where user_id=owner_id for update;
 if expected_revision is distinct from w.revision then raise exception 'Assignments changed. Reload before saving.';end if;
 insert into public.war_target_lists(user_id,faction_id,war_key,enemy_faction_id,target_ids,targets,priorities,active,updated_by,revision,verified_until,updated_at,war_start)
 values(owner_id,p.faction_id,p.war_key,p.enemy_id,ids,coalesce(values_json->'targets','[]'),coalesce(values_json->'priorities','{}'),true,p.torn_id,coalesce(w.revision,0)+1,now()+interval '2 minutes',now(),p.war_start)
 on conflict(user_id) do update set faction_id=excluded.faction_id,war_key=excluded.war_key,enemy_faction_id=excluded.enemy_faction_id,target_ids=excluded.target_ids,targets=excluded.targets,priorities=excluded.priorities,active=true,updated_by=excluded.updated_by,revision=excluded.revision,verified_until=excluded.verified_until,updated_at=excluded.updated_at,war_start=excluded.war_start returning * into result;
 if owner_id<>actor_user then
  perform private.war_notice(owner_id,'Member ['||p.torn_id||'] changed your target assignments. Reason: '||left(trim(reason),500));
  insert into public.war_events(user_id,faction_id,war_key,actor_torn_id,kind,details) values(owner_id,p.faction_id,p.war_key,p.torn_id,'assignment_reason',jsonb_build_object('reason',left(trim(reason),500),'targets',ids));
 end if;
 return to_jsonb(result);
end $$;

create or replace function public.rest_war_targets(owner_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.war_target_claims; w public.war_target_lists; count_saved integer:=0;
begin
 perform private.lock_war_claims();
 delete from public.war_wait_queue where user_id=owner_id;
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

create or replace function public.record_war_claim_attacks(owner_id uuid,records jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare c public.war_target_claims; a jsonb; added integer; completed integer:=0;
begin
 perform private.lock_war_claims();
 if jsonb_typeof(records)<>'array' or jsonb_array_length(records)>200 then raise exception 'Invalid attack page.';end if;
 for c in select * from public.war_target_claims where user_id=owner_id and expires_at>now() for update loop
  for a in select value from jsonb_array_elements(records) loop
   if (a->>'attacker')::bigint=c.claimant_torn_id and (a->>'defender')::bigint=c.target_id and (a->>'started')::numeric>=extract(epoch from c.claimed_at) and (a->>'ended')::numeric>=extract(epoch from c.claimed_at) and (a->>'ended')::numeric<=extract(epoch from now()) and a->>'id' ~ '^[0-9]+$' then
    insert into private.war_claim_attacks(claim_id,attack_id) values(c.claim_id,a->>'id') on conflict do nothing;get diagnostics added=row_count;
    if added=1 then c.attacks_done:=c.attacks_done+1;end if;
   end if;
  end loop;
  if c.attacks_done>=c.attacks_goal then
   delete from public.war_target_claims where claim_id=c.claim_id;
   insert into public.war_events(user_id,faction_id,war_key,actor_torn_id,kind,details) values(owner_id,c.faction_id,c.war_key,c.claimant_torn_id,'claim_completed',jsonb_build_object('target_id',c.target_id,'attacks',c.attacks_done,'goal',c.attacks_goal));completed:=completed+1;
  else
   update public.war_target_claims set attacks_done=c.attacks_done,expires_at=case when attacks_done<c.attacks_done then least(now()+interval '10 minutes',claimed_at+interval '1 hour') else expires_at end where claim_id=c.claim_id;
  end if;
 end loop;
 return completed;
end $$;

create or replace function public.resume_war_targets(owner_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare w public.war_target_lists;a public.linked_torn_accounts;r public.war_rest_claims;held public.war_target_claims;
 resumed jsonb:='[]';blocked jsonb:='[]';discarded jsonb:='[]';created uuid;reason text;q public.war_wait_queue;assigned bigint;
begin
 perform private.lock_war_claims();
 select * into w from public.war_target_lists where user_id=owner_id for update;
 if not found then raise exception 'Choose your war targets first.';end if;
 if not exists(select 1 from public.war_rest_claims where user_id=owner_id) then
  update public.war_target_lists set resting=false where user_id=owner_id;
  return jsonb_build_object('resumed',resumed,'blocked',blocked,'discarded',discarded);
 end if;
 select * into a from public.linked_torn_accounts where user_id=owner_id and revoked_at is null;
 if not found then raise exception 'Link your current Torn identity first.';end if;
 if w.active and (w.verified_until<=now() or not exists(select 1 from private.war_memberships m where m.user_id=owner_id and m.torn_id=a.torn_id and m.faction_id=w.faction_id and m.verified_until>now())) then raise exception 'Refresh faction verification first.';end if;
 update public.war_target_lists set resting=false where user_id=owner_id;
 for r in select * from public.war_rest_claims where user_id=owner_id for update loop
  reason:=null;
  if r.attacks_done>=r.attacks_goal then reason:='Attack goal already completed';
  elsif not w.active or r.war_key<>w.war_key or r.faction_id<>w.faction_id or r.claimant_torn_id<>a.torn_id then reason:='War or faction changed';
  elsif not(r.target_id=any(w.target_ids)) or not exists(select 1 from jsonb_array_elements(w.targets) t where (t->>'id')::bigint=r.target_id) then reason:='Target is no longer assigned or in the enemy roster';end if;
  if reason is not null then
   discarded:=discarded||jsonb_build_array(jsonb_build_object('target_id',r.target_id,'name',r.target_name,'reason',reason));
   delete from public.war_rest_claims where user_id=owner_id and war_key=r.war_key and target_id=r.target_id;continue;
  end if;
  select assignee_id into assigned from public.war_target_rules where faction_id=w.faction_id and war_key=w.war_key and target_id=r.target_id;
  if assigned is not null and assigned<>a.torn_id then
   discarded:=discarded||jsonb_build_array(jsonb_build_object('target_id',r.target_id,'name',r.target_name,'reason','Leadership assigned the target to another member'));delete from public.war_rest_claims where user_id=owner_id and war_key=r.war_key and target_id=r.target_id;continue;
  end if;
  q:=private.queue_head(w.faction_id,w.war_key,r.target_id);
  if exists(select 1 from public.war_target_claims where (user_id=owner_id or (faction_id=w.faction_id and war_key=w.war_key and target_id=r.target_id)) and expires_at>now()) or (q.id is not null and q.user_id<>owner_id) then
   if assigned is null then
    insert into public.war_wait_queue(faction_id,war_key,target_id,user_id,torn_id,player_name,attacks_goal,resume_goal) values(w.faction_id,w.war_key,r.target_id,owner_id,a.torn_id,a.torn_name,greatest(1,r.attacks_goal-r.attacks_done),true) on conflict(faction_id,war_key,target_id,user_id) do update set resume_goal=true;
   end if;
   blocked:=blocked||jsonb_build_array(jsonb_build_object('target_id',r.target_id,'name',r.target_name,'reason',case when assigned is null then 'Queued at the back; waiting for your turn or your current reservation to finish' else 'Finish your current reservation first' end));continue;
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
   delete from public.war_wait_queue where user_id=owner_id and faction_id=w.faction_id and war_key=w.war_key and target_id=r.target_id;
   resumed:=resumed||jsonb_build_array(jsonb_build_object('target_id',r.target_id,'name',r.target_name,'remaining',r.attacks_goal-r.attacks_done));
   delete from public.war_rest_claims where user_id=owner_id and war_key=r.war_key and target_id=r.target_id;
  end if;
 end loop;
 update public.war_target_lists set resting=false where user_id=owner_id;
 delete from private.war_claim_scans where user_id=owner_id;
 insert into public.war_events(user_id,faction_id,war_key,actor_torn_id,kind,details) values(owner_id,w.faction_id,w.war_key,a.torn_id,'return',jsonb_build_object('resumed',resumed,'blocked',blocked,'discarded',discarded));
 return jsonb_build_object('resumed',resumed,'blocked',blocked,'discarded',discarded);
end $$;

do $$ declare r record;begin
 for r in select p.oid::regprocedure as name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname in ('verify_war_command','war_governance','commit_war_assignments')) or (n.nspname='private' and p.proname in ('war_proof','war_manager','war_notice','queue_head')) loop
  execute 'revoke all on function '||r.name||' from public,anon,authenticated';execute 'grant execute on function '||r.name||' to service_role';
 end loop;
end $$;

alter publication supabase_realtime add table public.war_wait_queue,public.war_target_rules,public.war_transfer_requests,public.war_handlers,public.war_claim_policies;
