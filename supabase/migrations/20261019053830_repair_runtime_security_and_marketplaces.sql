-- Repair the deployed schema; historical SQL in this repository differs from production.
-- Money is Torn dollars. Direct-payment contracts do not represent operator custody.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
alter table public.loss_disputes add column if not exists resolution_notes text;
alter table public.loss_claims add column if not exists quantity_verified integer not null default 0 check (quantity_verified >= 0 and quantity_verified <= quantity);
alter table public.loss_claims add column if not exists reconcile_until timestamptz;
update public.loss_claims set reconcile_until = expires_at + interval '10 minutes' where reconcile_until is null;
alter table public.loss_claims alter column reconcile_until set not null;
alter table public.loss_claims alter column expires_at set default (now() + interval '15 minutes');
alter table public.loss_claims alter column reconcile_until set default (now() + interval '25 minutes');
alter table public.loss_claims add column if not exists last_loss_at timestamptz;
create unique index if not exists loss_one_active_seller on public.loss_claims(seller_user_id) where status='active';
create unique index if not exists loss_one_settlement_per_claim on public.loss_settlement_entries(claim_id);
create unique index if not exists loss_unique_payment_reference on public.loss_settlement_entries(transaction_ref) where transaction_ref is not null;
create unique index if not exists loss_unique_funding_reference on public.loss_funding_records(transaction_ref) where transaction_ref is not null;
create unique index if not exists credentials_user_provider_unique on public.encrypted_credentials(user_id, provider);
create unique index if not exists linked_account_one_user on public.linked_torn_accounts(user_id);
alter table public.profiles add column if not exists tracking_paused boolean not null default false;

-- Application users cannot grant themselves privileged roles or authoritative identities.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update(display_name, timezone, onboarded, tracking_paused) on public.profiles to authenticated;
revoke insert, update, delete on public.memberships, public.linked_torn_accounts from anon, authenticated;
drop policy if exists memberships_select_faction_leaders on public.memberships;
revoke all on public.encrypted_credentials from anon, authenticated;
grant select(provider, user_id, created_at) on public.encrypted_credentials to authenticated;

-- Drop permissive mutation policies; verification and money changes go through audited RPCs.
do $$ declare r record; begin
  for r in select schemaname,tablename,policyname from pg_policies where schemaname='public' and tablename in ('loss_contracts','loss_claims','loss_attack_evidence','loss_funding_records','loss_settlement_entries','loss_disputes','revive_contracts','revive_claims','revive_evidence') loop
    execute format('drop policy %I on %I.%I',r.policyname,r.schemaname,r.tablename);
  end loop;
end $$;
revoke all on public.loss_attack_evidence, public.loss_settlement_entries, public.loss_claims, public.loss_funding_records, public.revive_claims, public.revive_evidence from anon, authenticated;
grant select on public.loss_attack_evidence, public.loss_settlement_entries, public.loss_claims, public.loss_funding_records, public.revive_claims, public.revive_evidence to authenticated;
revoke all on public.loss_contracts,public.revive_contracts,public.loss_disputes from anon,authenticated;
grant select on public.loss_contracts,public.revive_contracts,public.loss_disputes to authenticated;
grant insert on public.loss_contracts,public.revive_contracts,public.loss_disputes to authenticated;

create policy loss_contracts_read on public.loss_contracts for select to authenticated using (true);
create policy loss_contracts_create on public.loss_contracts for insert to authenticated with check (buyer_user_id=(select auth.uid()) and status='open' and funding_method='direct_payment' and price_per_loss>0 and target_player_id>0);
create policy loss_claims_read on public.loss_claims for select to authenticated using (seller_user_id=(select auth.uid()) or exists(select 1 from public.loss_contracts c where c.id=contract_id and c.buyer_user_id=(select auth.uid())) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','payment_operator')));
create policy loss_evidence_read on public.loss_attack_evidence for select to authenticated using (exists(select 1 from public.loss_claims c where c.id=claim_id) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','payment_operator')));
create policy loss_settlement_read on public.loss_settlement_entries for select to authenticated using (seller_user_id=(select auth.uid()) or exists(select 1 from public.loss_claims c where c.id=claim_id) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','payment_operator')));
create policy loss_funding_read on public.loss_funding_records for select to authenticated using (buyer_user_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','payment_operator')));
create policy loss_dispute_read on public.loss_disputes for select to authenticated using (raised_by=(select auth.uid()) or exists(select 1 from public.loss_claims c where c.id=claim_id) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','payment_operator')));
create policy loss_dispute_create on public.loss_disputes for insert to authenticated with check (raised_by=(select auth.uid()) and status='open' and resolved_at is null and resolution_notes is null and exists(select 1 from public.loss_claims c where c.id=claim_id));
create policy revive_contracts_read on public.revive_contracts for select to authenticated using (true);
create policy revive_contracts_create on public.revive_contracts for insert to authenticated with check (user_id=(select auth.uid()) and status='open' and target_torn_id>0);
create policy revive_claims_read on public.revive_claims for select to authenticated using (seller_user_id=(select auth.uid()) or exists(select 1 from public.revive_contracts c where c.id=contract_id and c.user_id=(select auth.uid())));
create policy revive_evidence_read on public.revive_evidence for select to authenticated using (exists(select 1 from public.revive_claims c where c.id=claim_id));

create table if not exists private.workflow_audit (
 id bigint generated always as identity primary key, actor uuid, action text not null, entity_id uuid, details jsonb not null default '{}', created_at timestamptz not null default now()
);
alter table private.workflow_audit enable row level security;
revoke all on private.workflow_audit from public,anon,authenticated;

-- Definer implementation is in a non-exposed schema. Every entry checks auth.uid().
create or replace function private.claim_loss_contract(contract uuid, requested integer) returns public.loss_claims
language plpgsql security definer set search_path='' as $$
declare c public.loss_contracts; result public.loss_claims; consumed integer; seller bigint;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if requested is null or requested<1 then raise exception 'Quantity must be positive'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 update public.loss_claims set status='expired' where seller_user_id=auth.uid() and status='active' and expires_at<=now();
 if exists(select 1 from public.loss_claims where seller_user_id=auth.uid() and status='active') then raise exception 'Only one active claim is allowed'; end if;
 select * into c from public.loss_contracts where id=contract for update;
 if not found or c.status<>'open' or (c.expires_at is not null and c.expires_at<=now()) then raise exception 'Contract is not open'; end if;
 if c.buyer_user_id=auth.uid() then raise exception 'You cannot claim your own contract'; end if;
 select torn_id into seller from public.linked_torn_accounts where user_id=auth.uid() and revoked_at is null;
 if seller is null then raise exception 'Link your Torn identity first'; end if;
 if seller=c.target_player_id then raise exception 'You cannot attack yourself'; end if;
 -- Reserved slots remain held during reconciliation, preventing late evidence from overselling.
 select coalesce(sum(case when reconcile_until>now() then quantity else quantity_verified end),0) into consumed from public.loss_claims where contract_id=contract;
 if requested>c.quantity-consumed then raise exception 'Insufficient remaining slots'; end if;
 insert into public.loss_claims(contract_id,seller_user_id,quantity,expires_at,reconcile_until) values(contract,auth.uid(),requested,now()+interval '15 minutes',now()+interval '25 minutes') returning * into result;
 insert into private.workflow_audit(actor,action,entity_id,details) values(auth.uid(),'claim_loss',result.id,jsonb_build_object('quantity',requested));
 return result;
end $$;
create or replace function public.claim_loss_contract(contract uuid, requested integer) returns public.loss_claims language sql security invoker set search_path='' as $$ select private.claim_loss_contract(contract,requested) $$;

create or replace function private.close_loss_claim(claim uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 update public.loss_claims set status='completed',completed_at=now(),expires_at=least(expires_at,now()),reconcile_until=least(expires_at,now())+interval '10 minutes' where id=claim and seller_user_id=auth.uid() and status='active';
 if not found then raise exception 'Active claim not found'; end if;
 insert into private.workflow_audit(actor,action,entity_id) values(auth.uid(),'close_loss_claim',claim);
end $$;
create or replace function public.close_loss_claim(claim uuid) returns void language sql security invoker set search_path='' as $$ select private.close_loss_claim(claim) $$;

-- Service-only atomic evidence + liability booking, globally deduplicated by attack ID.
create or replace function private.record_loss_attack(claim uuid, attack bigint, seller bigint, target bigint, event_time timestamptz, is_loss boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare cl public.loss_claims; c public.loss_contracts; evidence_id uuid; previous_time timestamptz; candidate record; accepted integer:=0; last_event timestamptz;
begin
 if current_setting('role',true)<>'service_role' then raise exception 'Service verification required'; end if;
 select * into cl from public.loss_claims where id=claim for update;
 if not found or cl.reconcile_until<now() then return false; end if;
 select * into c from public.loss_contracts where id=cl.contract_id for update;
 if not exists(select 1 from public.linked_torn_accounts a where a.user_id=cl.seller_user_id and a.torn_id=seller and a.revoked_at is null) or target<>c.target_player_id then return false; end if;
 if not is_loss or event_time<cl.claimed_at or event_time>cl.expires_at then return false; end if;
 insert into public.loss_attack_evidence(claim_id,attack_id,seller_torn_id,target_torn_id,attack_timestamp,outcome,verified)
 values(claim,attack,seller,target,event_time,'loss',false) on conflict(attack_id) do nothing returning id into evidence_id;
 if evidence_id is null then return false; end if;
 -- Re-evaluate by event time so a late record can bridge a previously unverified gap.
 update public.loss_attack_evidence set verified=false,verified_at=null where claim_id=claim;
 previous_time:=cl.claimed_at;
 for candidate in select id,attack_timestamp from public.loss_attack_evidence where claim_id=claim and outcome='loss' order by attack_timestamp,attack_id loop
   exit when accepted>=cl.quantity or candidate.attack_timestamp>previous_time+interval '5 minutes';
   update public.loss_attack_evidence set verified=true,verified_at=now() where id=candidate.id;
   accepted:=accepted+1; previous_time:=candidate.attack_timestamp; last_event:=candidate.attack_timestamp;
 end loop;
 update public.loss_claims set quantity_verified=accepted,last_loss_at=last_event,status=case when accepted=quantity then 'completed' else status end,completed_at=case when accepted=quantity then now() else completed_at end where id=claim;
 if accepted>0 then
  insert into public.loss_settlement_entries(claim_id,seller_user_id,amount_owed) values(claim,cl.seller_user_id,accepted*c.price_per_loss)
  on conflict(claim_id) do update set amount_owed=excluded.amount_owed;
 end if;
 insert into private.workflow_audit(action,entity_id,details) values('verify_loss',claim,jsonb_build_object('attack_id',attack,'verified_quantity',accepted,'amount',accepted*c.price_per_loss));
 return (select verified from public.loss_attack_evidence where id=evidence_id);
end $$;
create or replace function public.record_loss_attack(claim uuid, attack bigint, seller bigint, target bigint, event_time timestamptz, is_loss boolean) returns boolean language sql security invoker set search_path='' as $$ select private.record_loss_attack(claim,attack,seller,target,event_time,is_loss) $$;

create or replace function private.set_loss_contract_status(contract uuid,next_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or next_status not in ('open','paused','cancelled') then raise exception 'Invalid request'; end if;
 update public.loss_contracts set status=next_status where id=contract and buyer_user_id=auth.uid() and status in ('open','paused');
 if not found then raise exception 'Contract not available'; end if;
 insert into private.workflow_audit(actor,action,entity_id,details) values(auth.uid(),'contract_status',contract,jsonb_build_object('status',next_status));
end $$;
create or replace function public.set_loss_contract_status(contract uuid,next_status text) returns void language sql security invoker set search_path='' as $$ select private.set_loss_contract_status(contract,next_status) $$;

create or replace function private.transition_loss_settlement(entry uuid,next_status text,reference text default null) returns void language plpgsql security definer set search_path='' as $$
declare s public.loss_settlement_entries; buyer uuid; operator boolean; cl public.loss_claims;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into s from public.loss_settlement_entries where id=entry for update;
 if not found then raise exception 'Settlement not found'; end if;
 select * into cl from public.loss_claims where id=s.claim_id;
 select buyer_user_id into buyer from public.loss_contracts where id=cl.contract_id;
 select role in ('payment_operator','admin') into operator from public.profiles where id=auth.uid();
 if next_status='reconciled' then
   if s.status<>'sent' or s.seller_user_id<>auth.uid() then raise exception 'Seller must confirm receipt'; end if;
 elsif auth.uid()<>buyer and not coalesce(operator,false) then raise exception 'Buyer or operator required';
 end if;
 if cl.status='active' or cl.reconcile_until>now() then raise exception 'Wait for claim reconciliation before settlement'; end if;
 if next_status='approved' and s.status='earned' then
   update public.loss_settlement_entries set status='approved',approved_at=now() where id=entry;
 elsif next_status='sent' and s.status='approved' and length(trim(reference))>0 then
   update public.loss_settlement_entries set status='sent',sent_at=now(),amount_paid=amount_owed,transaction_ref=reference where id=entry;
 elsif next_status='reconciled' and s.status='sent' then
   update public.loss_settlement_entries set status='reconciled',reconciled_at=now() where id=entry;
 else raise exception 'Invalid settlement transition'; end if;
 insert into private.workflow_audit(actor,action,entity_id,details) values(auth.uid(),'settlement_transition',entry,jsonb_build_object('from',s.status,'to',next_status,'reference',reference));
end $$;
create or replace function public.transition_loss_settlement(entry uuid,next_status text,reference text default null) returns void language sql security invoker set search_path='' as $$ select private.transition_loss_settlement(entry,next_status,reference) $$;

create or replace function private.resolve_loss_dispute(dispute uuid,next_status text,notes text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','payment_operator')) then raise exception 'Operator required'; end if;
 if next_status not in ('resolved','rejected') or length(trim(notes))=0 then raise exception 'Resolution and notes required'; end if;
 update public.loss_disputes set status=next_status,resolved_at=now(),resolution_notes=notes where id=dispute and status='open';
 if not found then raise exception 'Open dispute not found'; end if;
 insert into private.workflow_audit(actor,action,entity_id,details) values(auth.uid(),'dispute_resolution',dispute,jsonb_build_object('status',next_status,'notes',notes));
end $$;
create or replace function public.resolve_loss_dispute(dispute uuid,next_status text,notes text) returns void language sql security invoker set search_path='' as $$ select private.resolve_loss_dispute(dispute,next_status,notes) $$;

create or replace function private.claim_revive_contract(contract uuid,requested integer) returns public.revive_claims language plpgsql security definer set search_path='' as $$
declare c public.revive_contracts; result public.revive_claims; used integer; player public.linked_torn_accounts;
begin
 if auth.uid() is null or requested is null or requested<1 then raise exception 'Sign in and positive quantity required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 select * into c from public.revive_contracts where id=contract for update;
 if not found or c.status<>'open' or c.user_id=auth.uid() or (c.expires_at is not null and c.expires_at<=now()) then raise exception 'Request is unavailable'; end if;
 update public.revive_claims set status='expired' where contract_id=contract and status='active' and expires_at<=now();
 select coalesce(sum(quantity_claimed),0) into used from public.revive_claims where contract_id=contract and status in ('active','completed');
 if requested>c.quantity-used then raise exception 'Insufficient remaining slots'; end if;
 select * into player from public.linked_torn_accounts where user_id=auth.uid() and revoked_at is null;
 if not found then raise exception 'Link your Torn identity first'; end if;
 insert into public.revive_claims(contract_id,seller_user_id,seller_torn_id,seller_name,quantity_claimed) values(contract,auth.uid(),player.torn_id,coalesce(player.torn_name,player.torn_id::text),requested) returning * into result;
 return result;
end $$;
create or replace function public.claim_revive_contract(contract uuid,requested integer) returns public.revive_claims language sql security invoker set search_path='' as $$ select private.claim_revive_contract(contract,requested) $$;
create or replace function private.finish_revive_claim(claim uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 update public.revive_claims set status='completed',completed_at=now(),notes='Seller-reported completion; not API-verified' where id=claim and seller_user_id=auth.uid() and status='active' and expires_at>now();
 if not found then raise exception 'Active claim not found'; end if;
end $$;
create or replace function public.finish_revive_claim(claim uuid) returns void language sql security invoker set search_path='' as $$ select private.finish_revive_claim(claim) $$;
create or replace function private.cancel_revive_contract(contract uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 update public.revive_contracts set status='cancelled' where id=contract and user_id=auth.uid() and status in ('open','paused');
 if not found then raise exception 'Request not found'; end if;
end $$;
create or replace function public.cancel_revive_contract(contract uuid) returns void language sql security invoker set search_path='' as $$ select private.cancel_revive_contract(contract) $$;

-- Internal cron authorization uses a Vault token, never a service-role key in SQL settings.
select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'tcc_job_token') where not exists(select 1 from vault.secrets where name='tcc_job_token');
create or replace function private.authorize_scheduled_job(job_token text) returns boolean language sql security definer set search_path='' as $$ select exists(select 1 from vault.decrypted_secrets where name='tcc_job_token' and decrypted_secret=job_token) $$;
create or replace function public.authorize_scheduled_job(job_token text) returns boolean language sql security invoker set search_path='' as $$ select private.authorize_scheduled_job(job_token) $$;

-- Privileged functions are never executable through PUBLIC defaults.
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function private.claim_loss_contract(uuid,integer),private.close_loss_claim(uuid),private.set_loss_contract_status(uuid,text),private.transition_loss_settlement(uuid,text,text),private.resolve_loss_dispute(uuid,text,text),private.claim_revive_contract(uuid,integer),private.finish_revive_claim(uuid),private.cancel_revive_contract(uuid) to authenticated;
grant execute on function private.record_loss_attack(uuid,bigint,bigint,bigint,timestamptz,boolean),private.authorize_scheduled_job(text) to service_role;
revoke execute on function public.record_loss_attack(uuid,bigint,bigint,bigint,timestamptz,boolean),public.authorize_scheduled_job(text) from public,anon,authenticated;
grant execute on function public.record_loss_attack(uuid,bigint,bigint,bigint,timestamptz,boolean),public.authorize_scheduled_job(text) to service_role;
revoke execute on function public.claim_loss_contract(uuid,integer),public.close_loss_claim(uuid),public.set_loss_contract_status(uuid,text),public.transition_loss_settlement(uuid,text,text),public.resolve_loss_dispute(uuid,text,text),public.claim_revive_contract(uuid,integer),public.finish_revive_claim(uuid),public.cancel_revive_contract(uuid) from public,anon;
grant execute on function public.claim_loss_contract(uuid,integer),public.close_loss_claim(uuid),public.set_loss_contract_status(uuid,text),public.transition_loss_settlement(uuid,text,text),public.resolve_loss_dispute(uuid,text,text),public.claim_revive_contract(uuid,integer),public.finish_revive_claim(uuid),public.cancel_revive_contract(uuid) to authenticated;
alter function public.touch_updated_at() set search_path='';
alter function public.enforce_watch_limit() set search_path='';
alter function public.handle_new_user() set search_path='';
revoke execute on function public.enforce_watch_limit(),public.handle_new_user() from public,anon,authenticated;

-- Publish only RLS-protected coordination data.
do $$ declare t text; begin
 foreach t in array array['revive_contracts','revive_claims','loss_contracts','loss_claims','loss_settlement_entries','chain_target_queue'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if;
 end loop;
end $$;
-- Existing funding automation assumes an undocumented transfer shape and no actual custodian.
select cron.unschedule(jobid) from cron.job where jobname in ('verify-loss-funding','verify-loss-payment');
select cron.schedule('verify-loss-payment','*/2 * * * *',$job$
 select net.http_post(url:='https://caxhhhtrlqfuatraamto.supabase.co/functions/v1/verify-loss-payment',headers:=jsonb_build_object('Content-Type','application/json','x-job-token',(select decrypted_secret from vault.decrypted_secrets where name='tcc_job_token')),body:='{}'::jsonb);
$job$);

create or replace function private.loss_contract_availability() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 return coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('remaining',greatest(0,c.quantity-coalesce(v.used,0)),'verified',coalesce(v.verified,0))) from public.loss_contracts c left join lateral (select sum(case when reconcile_until>now() then quantity else quantity_verified end) as used,sum(quantity_verified) as verified from public.loss_claims where contract_id=c.id) v on true),'[]'::jsonb);
end $$;
create or replace function public.loss_contract_availability() returns jsonb language sql security invoker set search_path='' as $$ select private.loss_contract_availability() $$;
revoke execute on function private.loss_contract_availability(),public.loss_contract_availability() from public,anon;
grant execute on function private.loss_contract_availability(),public.loss_contract_availability() to authenticated;
alter table public.live_feed_cache drop constraint if exists live_feed_cache_feed_type_check;
alter table public.live_feed_cache add constraint live_feed_cache_feed_type_check check (feed_type in ('travel','market','stocks','company','overview'));

alter table public."linked_torn_accounts" alter column user_id set default auth.uid();
alter table public."integration_connections" alter column user_id set default auth.uid();
alter table public."spy_import_jobs" alter column user_id set default auth.uid();
alter table public."report_snapshots" alter column user_id set default auth.uid();
alter table public."halloween_candy_log" alter column user_id set default auth.uid();
alter table public."faction_members" alter column user_id set default auth.uid();
alter table public."faction_chain_state" alter column user_id set default auth.uid();
alter table public."faction_armory" alter column user_id set default auth.uid();
alter table public."faction_territory" alter column user_id set default auth.uid();
alter table public."faction_membership_events" alter column user_id set default auth.uid();
alter table public."alliance_sharing_grants" alter column user_id set default auth.uid();
alter table public."faction_money_requests" alter column user_id set default auth.uid();
alter table public."faction_ledger_entries" alter column user_id set default auth.uid();
alter table public."faction_upgrade_simulations" alter column user_id set default auth.uid();
alter table public."faction_armory_events" alter column user_id set default auth.uid();
alter table public."faction_loans" alter column user_id set default auth.uid();
alter table public."ai_consents" alter column user_id set default auth.uid();
alter table public."ai_analysis_requests" alter column user_id set default auth.uid();
alter table public."travel_profit_scenarios" alter column user_id set default auth.uid();
alter table public."oc_plans" alter column user_id set default auth.uid();
alter table public."chain_target_queue" alter column user_id set default auth.uid();
alter table public."revive_logs" alter column user_id set default auth.uid();
alter table public."daily_digests" alter column user_id set default auth.uid();
alter table public."revive_contracts" alter column user_id set default auth.uid();
alter table public."encrypted_credentials" alter column user_id set default auth.uid();
alter table public."consents" alter column user_id set default auth.uid();
alter table public."feature_permissions" alter column user_id set default auth.uid();
alter table public."memberships" alter column user_id set default auth.uid();
alter table public."goals" alter column user_id set default auth.uid();
alter table public."target_lists" alter column user_id set default auth.uid();
alter table public."player_observations" alter column user_id set default auth.uid();
alter table public."estimates" alter column user_id set default auth.uid();
alter table public."notification_events" alter column user_id set default auth.uid();
alter table public."alert_rules" alter column user_id set default auth.uid();
alter table public."target_claims" alter column user_id set default auth.uid();
alter table public."payout_policies" alter column user_id set default auth.uid();
alter table public."payout_runs" alter column user_id set default auth.uid();
alter table public."wars" alter column user_id set default auth.uid();
alter table public."company_snapshots" alter column user_id set default auth.uid();
alter table public."property_records" alter column user_id set default auth.uid();
alter table public."travel_observations" alter column user_id set default auth.uid();
alter table public."market_snapshots" alter column user_id set default auth.uid();
alter table public."watchlists" alter column user_id set default auth.uid();
alter table public."stock_holdings" alter column user_id set default auth.uid();
alter table public."racing_records" alter column user_id set default auth.uid();
alter table public."live_feed_cache" alter column user_id set default auth.uid();
alter table public."notifications" alter column user_id set default auth.uid();
alter table public."estimate_settings" alter column user_id set default auth.uid();
alter table public."alliance_members" alter column user_id set default auth.uid();
alter table public."watched_factions" alter column user_id set default auth.uid();
alter table public."recruitment_requirements" alter column user_id set default auth.uid();
alter table public."recruitment_candidates" alter column user_id set default auth.uid();
alter table public."gym_sessions" alter column user_id set default auth.uid();
alter table public."activity_observations" alter column user_id set default auth.uid();
alter table public."graffiti_reactions" alter column user_id set default auth.uid();
alter table public."bounties" alter column user_id set default auth.uid();
alter table public."custom_columns" alter column user_id set default auth.uid();
alter table public."custom_entries" alter column user_id set default auth.uid();
alter table public."spy_reports" alter column user_id set default auth.uid();
alter table public."dibs" alter column user_id set default auth.uid();
alter table public."war_hits" alter column user_id set default auth.uid();
alter table public."crime_logs" alter column user_id set default auth.uid();
alter table public."flight_logs" alter column user_id set default auth.uid();
alter table public."discord_webhooks" alter column user_id set default auth.uid();
alter table public."target_pools" alter column user_id set default auth.uid();
alter table public."notification_preferences" alter column user_id set default auth.uid();
alter table public."assistant_logs" alter column user_id set default auth.uid();

create or replace function private.guard_account_deletion() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.loss_claims cl join public.loss_contracts c on c.id=cl.contract_id where (cl.seller_user_id=old.id or c.buyer_user_id=old.id) and cl.reconcile_until>now())
 or exists(select 1 from public.loss_settlement_entries s join public.loss_claims cl on cl.id=s.claim_id join public.loss_contracts c on c.id=cl.contract_id where (cl.seller_user_id=old.id or c.buyer_user_id=old.id) and s.status<>'reconciled')
 or exists(select 1 from public.revive_claims cl join public.revive_contracts c on c.id=cl.contract_id where (cl.seller_user_id=old.id or c.user_id=old.id) and cl.status='active' and cl.expires_at>now()) then raise exception 'Unsettled marketplace records prevent account deletion'; end if;
 return old;
end $$;
revoke all on function private.guard_account_deletion() from public,anon,authenticated;
create trigger protect_unsettled_accounts before delete on public.profiles for each row execute function private.guard_account_deletion();
create table public.api_usage(id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles(id) on delete set null,endpoint text not null,cost_cents numeric,created_at timestamptz not null default now());
alter table public.api_usage enable row level security;
grant select on public.api_usage to authenticated;
create policy api_usage_admin_read on public.api_usage for select to authenticated using (exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'));

select cron.unschedule(jobid) from cron.job where jobname='evaluate-alerts';
select cron.schedule('evaluate-alerts','*/5 * * * *',$job$select net.http_post(url:='https://caxhhhtrlqfuatraamto.supabase.co/functions/v1/evaluate-alerts',headers:=jsonb_build_object('Content-Type','application/json','x-job-token',(select decrypted_secret from vault.decrypted_secrets where name='tcc_job_token')),body:='{}'::jsonb);$job$);

-- Repair payout persistence against the deployed schema; all writes are transactional.
alter table public.payout_policies add column if not exists config jsonb not null default '{}';
alter table public.payout_runs add column if not exists total_pool_cents bigint not null default 0;
alter table public.payout_runs add column if not exists allocated_cents bigint not null default 0;
alter table public.payout_runs add column if not exists retained_cents bigint not null default 0;
alter table public.payout_runs drop constraint if exists payout_runs_status_check;
alter table public.payout_runs add constraint payout_runs_status_check check(status in ('draft','preview','locked','approved','paid','reconciled'));
alter table public.payout_lines add column if not exists member_id text;
alter table public.payout_lines add column if not exists eligible_points numeric not null default 0;
alter table public.payout_lines add column if not exists share_cents bigint not null default 0;
alter table public.payout_lines add column if not exists bonus_cents bigint not null default 0;
alter table public.payout_lines add column if not exists reimbursement_cents bigint not null default 0;
alter table public.payout_lines add column if not exists adjustment_cents bigint not null default 0;
alter table public.payout_lines add column if not exists amount_owed_cents bigint not null default 0;
alter table public.payout_lines add column if not exists paid_cents bigint not null default 0;
alter table public.payout_lines add column if not exists status text not null default 'pending';
alter table public.payout_lines add column if not exists explanation text;
revoke insert,update,delete on public.payout_policies,public.payout_runs,public.payout_lines,public.payout_audit from anon,authenticated;
create or replace function private.save_payout_preview(war uuid,pool bigint,allocation_mode text,allocation_lines jsonb) returns public.payout_runs language plpgsql security definer set search_path='' as $$
declare policy uuid; result public.payout_runs; line jsonb; allocated bigint:=0; owed bigint;
begin
 if auth.uid() is null or not exists(select 1 from public.wars where id=war and user_id=auth.uid()) then raise exception 'Your own war record is required'; end if;
 if pool<0 or allocation_mode not in ('equal','proportional','weighted','hybrid') or jsonb_typeof(allocation_lines)<>'array' or jsonb_array_length(allocation_lines)<1 then raise exception 'Invalid allocation'; end if;
 for line in select value from jsonb_array_elements(allocation_lines) loop
  owed:=(line->>'amount_owed_cents')::bigint;
  if owed<0 or (line->>'share_cents')::bigint<0 or owed<>(line->>'share_cents')::bigint+(line->>'bonus_cents')::bigint+(line->>'reimbursement_cents')::bigint+(line->>'adjustment_cents')::bigint then raise exception 'Invalid payment arithmetic'; end if;
  allocated:=allocated+owed;
 end loop;
 if allocated>pool then raise exception 'Allocation exceeds pool'; end if;
 insert into public.payout_policies(war_id,user_id,distributable_pool,mode,locked,config) values(war,auth.uid(),pool,case when allocation_mode='equal' then 'equal_per_hit' else allocation_mode end,true,allocation_lines) returning id into policy;
 insert into public.payout_runs(policy_id,user_id,total_allocated,total_pool_cents,allocated_cents,retained_cents,status) values(policy,auth.uid(),allocated,pool,allocated,pool-allocated,'preview') returning * into result;
 for line in select value from jsonb_array_elements(allocation_lines) loop
  insert into public.payout_lines(run_id,member_name,member_id,points,amount,eligible_points,share_cents,bonus_cents,reimbursement_cents,adjustment_cents,amount_owed_cents,explanation)
  values(result.id,line->>'member_name',line->>'member_id',(line->>'eligible_points')::numeric,(line->>'amount_owed_cents')::bigint,(line->>'eligible_points')::numeric,(line->>'share_cents')::bigint,(line->>'bonus_cents')::bigint,(line->>'reimbursement_cents')::bigint,(line->>'adjustment_cents')::bigint,(line->>'amount_owed_cents')::bigint,line->>'explanation');
 end loop;
 insert into public.payout_audit(run_id,actor_id,action,details) values(result.id,auth.uid(),'calculated',jsonb_build_object('pool',pool,'allocated',allocated,'mode',allocation_mode));
 return result;
end $$;
create or replace function public.save_payout_preview(war uuid,pool bigint,allocation_mode text,allocation_lines jsonb) returns public.payout_runs language sql security invoker set search_path='' as $$ select private.save_payout_preview(war,pool,allocation_mode,allocation_lines) $$;
create or replace function private.transition_payout_run(run uuid,next_status text) returns public.payout_runs language plpgsql security definer set search_path='' as $$
declare r public.payout_runs; expected text;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into r from public.payout_runs where id=run and user_id=auth.uid() for update;
 if not found then raise exception 'Run not found'; end if;
 expected:=case r.status when 'preview' then 'locked' when 'locked' then 'approved' when 'approved' then 'paid' when 'paid' then 'reconciled' else null end;
 if next_status is distinct from expected or expected is null then raise exception 'Invalid payout transition'; end if;
 update public.payout_runs set status=next_status where id=run returning * into r;
 if next_status='paid' then update public.payout_lines set paid=true,paid_cents=amount_owed_cents,status='paid' where run_id=run; end if;
 insert into public.payout_audit(run_id,actor_id,action) values(run,auth.uid(),next_status);
 return r;
end $$;
create or replace function public.transition_payout_run(run uuid,next_status text) returns public.payout_runs language sql security invoker set search_path='' as $$ select private.transition_payout_run(run,next_status) $$;
revoke execute on function private.save_payout_preview(uuid,bigint,text,jsonb),public.save_payout_preview(uuid,bigint,text,jsonb),private.transition_payout_run(uuid,text),public.transition_payout_run(uuid,text) from public,anon;
grant execute on function private.save_payout_preview(uuid,bigint,text,jsonb),public.save_payout_preview(uuid,bigint,text,jsonb),private.transition_payout_run(uuid,text),public.transition_payout_run(uuid,text) to authenticated;

-- Owner-scoped queue actions use server time and compare-and-set semantics.
create or replace function private.claim_chain_target(entry uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 update public.chain_target_queue set status='claimed',claimed_by=auth.uid()::text,claimed_at=now(),claimed_until=now()+interval '5 minutes' where id=entry and user_id=auth.uid() and (status='open' or (status='claimed' and claimed_until<=now()));
 if not found then raise exception 'Target is already claimed or unavailable'; end if;
end $$;
create or replace function public.claim_chain_target(entry uuid) returns void language sql security invoker set search_path='' as $$ select private.claim_chain_target(entry) $$;
revoke execute on function private.claim_chain_target(uuid),public.claim_chain_target(uuid) from public,anon;
grant execute on function private.claim_chain_target(uuid),public.claim_chain_target(uuid) to authenticated;
revoke update on public.report_snapshots from anon,authenticated;

alter table public.loss_contracts add constraint loss_contracts_positive_whole_price check(price_per_loss>0 and price_per_loss=trunc(price_per_loss));
alter table public.loss_contracts add constraint loss_contracts_positive_target check(target_player_id>0);
