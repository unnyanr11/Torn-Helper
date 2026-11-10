-- Future campaigns only: never silently hide or alter previously published results.
lock table public.lucky_draw_campaigns,public.lucky_draw_winners in share row exclusive mode;
do $$ begin
 if exists(select 1 from public.lucky_draw_campaigns) or exists(select 1 from public.lucky_draw_winners)
 then raise exception 'Campaign data exists: review published reveal rules before applying this migration';end if;
end $$;
alter table public.lucky_draw_campaigns add column reveal_at timestamptz,
 add constraint lucky_draw_fixed_reveal_window check(reveal_at is null or (drawn_at is not null and closes_at is not null and reveal_at=closes_at+interval '48 hours'));
alter table public.lucky_draw_winners
 add column original_player_name text not null,
 add column name_corrected_at timestamptz,
 add column name_correction_reason text;
create table private.lucky_draw_name_audit (
 id uuid primary key default gen_random_uuid(),campaign_id uuid not null,rank integer not null,
 old_name text not null,new_name text not null,reason text not null,changed_by uuid,changed_at timestamptz not null default now(),
 foreign key(campaign_id,rank) references public.lucky_draw_winners(campaign_id,rank)
);
create index lucky_draw_name_audit_campaign on private.lucky_draw_name_audit(campaign_id,changed_at);
alter table private.lucky_draw_name_audit enable row level security;
revoke all on private.lucky_draw_name_audit from public,anon,authenticated;
-- Direct Data API reads must honor the same release boundary as the details RPC.
drop policy signed_in_read on public.lucky_draw_winners;
create policy revealed_results on public.lucky_draw_winners for select to authenticated using(
 (select auth.uid()) is not null and exists(select 1 from public.lucky_draw_campaigns c where c.id=campaign_id and c.drawn_at is not null and c.reveal_at<=now()));
create function private.finalize_lucky_draw(draw_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.lucky_draw_campaigns;players integer;pool bigint;used bigint;rank_no integer;winner record;p jsonb;
begin
 select * into c from public.lucky_draw_campaigns where id=draw_id for update;
 if not found then raise exception 'Campaign not found';end if;

  if c.cancelled_at is not null then return jsonb_build_object('state','cancelled');end if;
  if c.drawn_at is not null then return jsonb_build_object('state','already_drawn');end if;
  if c.closes_at is null then return jsonb_build_object('state','awaiting_minimum');end if;
  if now()<c.closes_at then return jsonb_build_object('state','entry_open');end if;
  if exists(select 1 from private.lucky_draw_submissions where campaign_id=c.id and status='pending') then return jsonb_build_object('state','awaiting_verification'); end if;
  select count(distinct torn_id),coalesce(sum(quantity),0),coalesce(sum(tickets),0) into players,pool,used
   from private.lucky_draw_submissions where campaign_id=c.id and status='approved';
  if used<c.minimum_entries then return jsonb_build_object('state','insufficient_entries');end if;
  if players<jsonb_array_length(c.prizes) then return jsonb_build_object('state','insufficient_players'); end if;
  if c.entry_verification='token' then
   if coalesce((select checked_through from private.lucky_draw_sync where campaign_id=c.id),0)<ceil(extract(epoch from c.closes_at)) then return jsonb_build_object('state','awaiting_log_sync'); end if;
   if exists(select 1 from private.lucky_draw_receipts where campaign_id=c.id and state='awaiting_eligibility') then return jsonb_build_object('state','awaiting_eligibility'); end if;
  end if;
  rank_no:=0;
  -- Exponential weighted sampling without replacement. Each approved ticket has
  -- equal weight, and a player can win only once. Randomness is server pgcrypto.
  for winner in
   select (array_agg(user_id) filter(where user_id is not null))[1] as user_id,torn_id,min(player_name) as player_name from private.lucky_draw_submissions where campaign_id=c.id and status='approved'
   group by torn_id
   order by -ln(((('x'||encode(extensions.gen_random_bytes(6),'hex'))::bit(48)::bigint)::numeric+1)/281474976710657)/sum(tickets)
   limit jsonb_array_length(c.prizes)
  loop
   p:=c.prizes->rank_no; rank_no:=rank_no+1;
   insert into public.lucky_draw_winners(campaign_id,rank,user_id,torn_id,player_name,prize_item,quantity,percentage,original_player_name)
    values(c.id,rank_no,winner.user_id,winner.torn_id,winner.player_name,
     case when c.prize_mode='pool' then c.entry_item else p->>'item' end,
     case when c.prize_mode='pool' then floor(pool*(p->>'percentage')::numeric/100)::bigint else (p->>'quantity')::bigint end,
     case when c.prize_mode='pool' then (p->>'percentage')::numeric end,winner.player_name);
  end loop;
  update public.lucky_draw_campaigns set drawn_at=now(),reveal_at=c.closes_at+interval '48 hours',pool_quantity=pool,eligible_players=players,eligible_tickets=used where id=c.id;
  return jsonb_build_object('state','drawn');

end $$;

create or replace function private.lucky_draw_action(action text, campaign uuid default null, payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); identity_row record; c public.lucky_draw_campaigns;
 s private.lucky_draw_submissions; p jsonb; tiers jsonb:='[]'; total numeric:=0;
 n integer; q bigint; cap integer; ticket_count integer; used bigint; pool bigint; players integer; rank_no integer;
 result jsonb; winner record; mode text; deadline timestamptz;
 audience_value text; faction_value bigint; level_value integer; proof jsonb;
 deposit_rule text; maximum_amount bigint; required_entries integer; after_days integer;
begin
 if actor is null then raise exception 'Sign in with Torn first'; end if;
 select torn_id,coalesce(torn_name,'Player '||torn_id) as name into identity_row
 from public.linked_torn_accounts where user_id=actor and revoked_at is null;
 if not found then raise exception 'A verified Torn account is required'; end if;
 if payload is null or jsonb_typeof(payload)<>'object' then raise exception 'Invalid campaign request'; end if;
 if action='create' then
  if lower(btrim(coalesce(payload->>'entry_item','')))='points' then raise exception 'Points cannot be used for entry without automatic received-log verification; choose cash or a sendable item'; end if;
  audience_value:=coalesce(payload->>'audience','all');
  if audience_value not in ('all','new_players','faction') then raise exception 'Choose a valid audience'; end if;
  if audience_value='faction' then
   select tc.payload into proof from public.torn_data_cache tc where user_id=actor and endpoint_id='v2-user-faction'
    and parameters='{}'::jsonb and fetched_at between now()-interval '5 minutes' and now() order by fetched_at desc limit 1;
   faction_value:=(proof#>>'{faction,id}')::bigint;
   if faction_value is null or faction_value<=0 then raise exception 'Refresh your Torn faction data before publishing a faction-only campaign'; end if;
  end if;
  if length(btrim(coalesce(payload->>'title',''))) not between 3 and 120 or length(coalesce(payload->>'description',''))>4000
   or length(btrim(coalesce(payload->>'entry_item',''))) not between 1 and 100 then raise exception 'Enter a title, entry item and valid description'; end if;
  q:=(payload->>'quantity_per_ticket')::bigint; cap:=(payload->>'max_tickets_per_player')::integer;
  mode:=payload->>'prize_mode';deadline:=null;
  deposit_rule:=coalesce(payload->>'deposit_mode','fixed');
  maximum_amount:=case when deposit_rule='fixed' then q else (payload->>'maximum_deposit')::bigint end;
  required_entries:=coalesce((payload->>'minimum_entries')::integer,1);
  after_days:=coalesce((payload->>'days_after_threshold')::integer,7);
  if deposit_rule not in ('fixed','range') or maximum_amount is null or maximum_amount<q or maximum_amount>1000000000000
   or required_entries not between 1 and 1000000 or after_days not between 1 and 365 then
   raise exception 'Choose an exact deposit or both minimum/maximum amounts, a positive entry requirement and 1–365 extra days';end if;
  if q is null or q not between 1 and 1000000000000 or cap is null or cap not between 1 and 10000
   or mode is null or mode not in ('pool','fixed')
   then raise exception 'Check the deposit amount and per-player entry limit'; end if;
  if jsonb_typeof(payload->'prizes') is distinct from 'array' then raise exception 'Add prize tiers'; end if;
  n:=jsonb_array_length(payload->'prizes');
  if n not between 1 and 50 then raise exception 'Choose between 1 and 50 prizes'; end if;
  for p in select value from jsonb_array_elements(payload->'prizes') loop
   if mode='pool' then
    if (p->>'percentage') is null or (p->>'percentage')::numeric<=0 or (p->>'percentage')::numeric>100
     or (p->>'percentage')::numeric<>round((p->>'percentage')::numeric,2) then raise exception 'Each percentage must be positive with at most two decimals'; end if;
    total:=total+(p->>'percentage')::numeric;
    tiers:=tiers||jsonb_build_array(jsonb_build_object('percentage',(p->>'percentage')::numeric));
   else
    if length(btrim(coalesce(p->>'item',''))) not between 1 and 100 or (p->>'quantity') is null
     or (p->>'quantity')::numeric not between 1 and 1000000000000 or (p->>'quantity')::numeric<>trunc((p->>'quantity')::numeric)
     then raise exception 'Each fixed prize needs an item and whole positive quantity'; end if;
    tiers:=tiers||jsonb_build_array(jsonb_build_object('item',btrim(p->>'item'),'quantity',(p->>'quantity')::bigint));
   end if;
  end loop;
  if total>100 then raise exception 'Prize percentages cannot exceed 100 in total'; end if;
  insert into public.lucky_draw_campaigns(host_user_id,host_torn_id,host_name,title,description,entry_item,quantity_per_ticket,max_tickets_per_player,prize_mode,prizes,closes_at,audience,faction_id,entry_verification,deposit_mode,maximum_deposit,minimum_entries,days_after_threshold,closing_policy)
   values(actor,identity_row.torn_id,identity_row.name,btrim(payload->>'title'),coalesce(payload->>'description',''),btrim(payload->>'entry_item'),q,cap,mode,tiers,deadline,audience_value,faction_value,'token',deposit_rule,maximum_amount,required_entries,after_days,'entry_threshold') returning * into c;
  return to_jsonb(c);
 end if;
 select * into c from public.lucky_draw_campaigns where id=campaign for update;
 if not found then raise exception 'Campaign not found'; end if;
 if action='receipts' then
  return private.lucky_draw_receipt_page(c.id,actor,coalesce((payload->>'offset')::integer,0));
 end if;
 if action='claim_received' then
  perform private.process_lucky_draw_receipts(c.id);
  return jsonb_build_object('processed',true);
 end if;
 if action='exclude_receipt' then
  if c.host_user_id<>actor or c.drawn_at is not null then raise exception 'Only the host of an undrawn campaign can exclude a receipt'; end if;
  if length(btrim(coalesce(payload->>'note',''))) not between 3 and 2000 then raise exception 'Explain why this received transfer is excluded'; end if;
  update private.lucky_draw_receipts set state='excluded',reason=btrim(payload->>'note') where campaign_id=c.id and log_id=payload->>'log_id' and state='awaiting_eligibility';
  if not found then raise exception 'Receipt is missing or cannot be excluded'; end if;
  return jsonb_build_object('excluded',true);
 end if;
 if action='details' then
  select jsonb_build_object('result_state',case when c.drawn_at is null then 'pending' when now()<c.reveal_at then 'sealed' else 'revealed' end,
   'reveal_at',coalesce(c.reveal_at,c.closes_at+interval '48 hours'),
   'name_corrections',case when c.drawn_at is not null and now()>=c.reveal_at then coalesce((select jsonb_agg(jsonb_build_object('rank',a.rank,'old_name',a.old_name,'new_name',a.new_name,'reason',a.reason,'at',a.changed_at) order by a.changed_at) from private.lucky_draw_name_audit a where a.campaign_id=c.id),'[]'::jsonb) else '[]'::jsonb end,
   'campaign',to_jsonb(c),'is_host',c.host_user_id=actor,'viewer_torn_id',identity_row.torn_id,
   'receipt_data',private.lucky_draw_receipt_page(c.id,actor,0),
   'sync',case when c.host_user_id=actor then (select jsonb_build_object('checked_through',checked_through,'has_more',next_parameters is not null,'pages',pages) from private.lucky_draw_sync where campaign_id=c.id) end,
   'entry_count',(select coalesce(sum(tickets),0) from private.lucky_draw_submissions where campaign_id=c.id and status='approved'),
   'submissions',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from private.lucky_draw_submissions e where e.campaign_id=c.id and (c.host_user_id=actor or e.torn_id=identity_row.torn_id)),'[]'::jsonb),
   'pool_quantity',coalesce((select sum(e.quantity) from private.lucky_draw_submissions e where e.campaign_id=c.id and status='approved'),0),
   'eligible_players',(select count(distinct e.torn_id) from private.lucky_draw_submissions e where e.campaign_id=c.id and status='approved'),
   'pending_count',(select count(*) from private.lucky_draw_submissions e where e.campaign_id=c.id and status='pending'),
   'winners',coalesce((select jsonb_agg(to_jsonb(w) order by w.rank) from public.lucky_draw_winners w where w.campaign_id=c.id and c.reveal_at<=now()),'[]'::jsonb)) into result;
  return result;
 end if;
 if action='submit' then raise exception 'Only verified received transfers with the campaign token count as entries'; end if;
 if action='eligibility' then
  if c.host_user_id=actor then raise exception 'Hosts cannot enter their own draw'; end if;
  if c.cancelled_at is not null or c.drawn_at is not null or now()>=c.closes_at then raise exception 'Entries are closed'; end if;
  if c.audience='new_players' then
   select tc.payload into proof from public.torn_data_cache tc where user_id=actor and endpoint_id='v2-user-profile'
    and parameters='{}'::jsonb and fetched_at between now()-interval '5 minutes' and now() order by fetched_at desc limit 1;
   level_value:=(proof#>>'{profile,level}')::integer;
   if (proof#>>'{profile,id}')::bigint is distinct from identity_row.torn_id or level_value is null then raise exception 'Refresh your Torn profile to verify eligibility'; end if;
   if level_value not between 1 and 15 then raise exception 'This campaign is restricted to levels 1–15 at entry'; end if;
  elsif c.audience='faction' then
   select tc.payload into proof from public.torn_data_cache tc where user_id=actor and endpoint_id='v2-user-faction'
    and parameters='{}'::jsonb and fetched_at between now()-interval '5 minutes' and now() order by fetched_at desc limit 1;
   faction_value:=(proof#>>'{faction,id}')::bigint;
   if faction_value is null then raise exception 'Refresh your Torn faction data to verify eligibility'; end if;
   if faction_value is distinct from c.faction_id then raise exception 'Only members of the campaign faction can enter'; end if;
  end if;
  if action='eligibility' then return jsonb_build_object('eligible',true); end if;
  if c.entry_verification='token' then raise exception 'Token campaigns accept only verified host received-transfer logs'; end if;
 end if;
 if action in ('approve','reject') then
  if action='approve' then raise exception 'Only automatically verified token transfers can be counted'; end if;
  if c.host_user_id<>actor then raise exception 'Only the host can review entries'; end if;
  if c.cancelled_at is not null then raise exception 'Campaign cancelled'; end if;
  if c.drawn_at is not null then raise exception 'The draw is already final'; end if;
  if length(coalesce(payload->>'note',''))>2000 or (action='reject' and length(btrim(coalesce(payload->>'note','')))<3) then raise exception 'Give a reason for rejecting the entry'; end if;
  update private.lucky_draw_submissions set status=case when action='approve' then 'approved' else 'rejected' end,reviewed_at=now(),review_note=payload->>'note'
   where id=(payload->>'submission_id')::uuid and campaign_id=c.id and status='pending' returning * into s;
  if not found then raise exception 'Entry is missing or already reviewed'; end if;
  return to_jsonb(s);
 end if;
 if action='draw' then
  if c.host_user_id<>actor then raise exception 'Only the host can request automatic finalization';end if;
  return private.finalize_lucky_draw(c.id);
 end if;
 if action='cancel' then
  if c.host_user_id<>actor then raise exception 'Only the host can cancel'; end if;
  if c.drawn_at is not null or c.cancelled_at is not null then raise exception 'Campaign is already final'; end if;
  if length(btrim(coalesce(payload->>'note',''))) not between 3 and 2000 then raise exception 'Give a cancellation reason'; end if;
  update public.lucky_draw_campaigns set cancelled_at=now(),cancellation_reason=btrim(payload->>'note') where id=c.id;
  return jsonb_build_object('cancelled',true);
 end if;
 if action='refund' then
  if c.host_user_id<>actor or c.cancelled_at is null then raise exception 'Only the host of a cancelled campaign can record refunds'; end if;
  if length(btrim(coalesce(payload->>'reference',''))) not between 3 and 200 then raise exception 'Enter the refund transfer reference'; end if;
  update private.lucky_draw_submissions set refund_reference=btrim(payload->>'reference'),refunded_at=now()
   where id=(payload->>'submission_id')::uuid and campaign_id=c.id and refunded_at is null;
  if not found then raise exception 'Entry is missing or already refunded'; end if;
  return jsonb_build_object('refunded',true);
 end if;
 if action='paid' then
  if c.reveal_at is null or now()<c.reveal_at then raise exception 'Prizes remain sealed until 48 hours after entry closing';end if;
  if c.host_user_id<>actor then raise exception 'Only the host can record payouts'; end if;
  if length(btrim(coalesce(payload->>'reference',''))) not between 3 and 200 then raise exception 'Enter the payout transfer reference'; end if;
  update public.lucky_draw_winners set payment_reference=btrim(payload->>'reference'),paid_at=now()
   where campaign_id=c.id and rank=(payload->>'rank')::integer and paid_at is null;
  if not found then raise exception 'Prize is missing or already marked sent'; end if;
  return jsonb_build_object('paid',true);
 end if;
 if action='received' then
  if c.reveal_at is null or now()<c.reveal_at then raise exception 'Results are not revealed yet';end if;
  update public.lucky_draw_winners set received_at=now() where campaign_id=c.id and rank=(payload->>'rank')::integer and torn_id=identity_row.torn_id and paid_at is not null and received_at is null;
  if not found then raise exception 'Only the winning player can confirm a sent prize'; end if;
  return jsonb_build_object('received',true);
 end if;
 raise exception 'Unknown campaign action';
end $$;

create function private.can_correct_lucky_draw_name() returns boolean
language sql stable security definer set search_path='' as $$
 select current_setting('role',true) in ('service_role','postgres','supabase_admin')
 or (current_setting('role',true)='none' and session_user in ('postgres','supabase_admin'))
 or (auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid() and role='admin'));
$$;
create function private.guard_lucky_draw_winner_update() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if row(new.campaign_id,new.rank,new.user_id,new.torn_id,new.prize_item,new.quantity,new.percentage,new.original_player_name)
  is distinct from row(old.campaign_id,old.rank,old.user_id,old.torn_id,old.prize_item,old.quantity,old.percentage,old.original_player_name)
 then raise exception 'The random winning identity, rank and prize are immutable';end if;
 if new.player_name is distinct from old.player_name then
  if not private.can_correct_lucky_draw_name() then raise exception 'Administrator access is required for display-name corrections';end if;
  if length(btrim(coalesce(new.player_name,''))) not between 1 and 100 or length(btrim(coalesce(new.name_correction_reason,''))) not between 3 and 2000
  then raise exception 'Provide a display name and a correction reason';end if;
  new.player_name:=btrim(new.player_name);new.name_corrected_at:=now();
  insert into private.lucky_draw_name_audit(campaign_id,rank,old_name,new_name,reason,changed_by)
   values(old.campaign_id,old.rank,old.player_name,new.player_name,btrim(new.name_correction_reason),auth.uid());
 elsif row(new.name_corrected_at,new.name_correction_reason) is distinct from row(old.name_corrected_at,old.name_correction_reason) then
  raise exception 'Name-correction metadata can change only with an audited display-name correction';
 end if;
 return new;
end $$;
create trigger lucky_draw_winner_immutable before update on public.lucky_draw_winners for each row execute function private.guard_lucky_draw_winner_update();
create function private.admin_correct_lucky_draw_name(draw_id uuid,prize_rank integer,display_name text,correction_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not private.can_correct_lucky_draw_name() then raise exception 'Administrator access is required';end if;
 if display_name is null or correction_reason is null then raise exception 'Provide a display name and reason';end if;
 update public.lucky_draw_winners set player_name=display_name,name_correction_reason=correction_reason where campaign_id=draw_id and rank=prize_rank;
 if not found then raise exception 'Winner not found';end if;
 return jsonb_build_object('corrected',true);
end $$;
create function public.admin_correct_lucky_draw_name(draw_id uuid,prize_rank integer,display_name text,correction_reason text) returns jsonb
 language sql security invoker set search_path='' as $$select private.admin_correct_lucky_draw_name(draw_id,prize_rank,display_name,correction_reason)$$;
create function public.finalize_lucky_draw(draw_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.finalize_lucky_draw(draw_id)$$;
revoke all on function private.can_correct_lucky_draw_name(),private.guard_lucky_draw_winner_update(),private.finalize_lucky_draw(uuid) from public,anon,authenticated;
revoke all on function public.finalize_lucky_draw(uuid) from public,anon,authenticated;
grant execute on function private.finalize_lucky_draw(uuid),public.finalize_lucky_draw(uuid) to service_role;
revoke all on function private.admin_correct_lucky_draw_name(uuid,integer,text,text),public.admin_correct_lucky_draw_name(uuid,integer,text,text) from public,anon;
grant execute on function private.admin_correct_lucky_draw_name(uuid,integer,text,text),public.admin_correct_lucky_draw_name(uuid,integer,text,text) to authenticated,service_role;

create table private.lucky_draw_jobs (
 campaign_id uuid primary key references public.lucky_draw_campaigns(id),lease_token uuid,lease_until timestamptz,
 not_before timestamptz not null default now(),last_attempt_at timestamptz,last_failure text
);
create index lucky_draw_jobs_due on private.lucky_draw_jobs(not_before,lease_until);
alter table private.lucky_draw_jobs enable row level security;
revoke all on private.lucky_draw_jobs from public,anon,authenticated;
create function private.claim_lucky_draw_jobs() returns jsonb
language plpgsql security definer set search_path='' as $$
declare c record;job record;result jsonb:='[]';
begin
 insert into private.lucky_draw_jobs(campaign_id) select id from public.lucky_draw_campaigns where drawn_at is null and cancelled_at is null on conflict do nothing;
 for c in select j.campaign_id,d.host_user_id from private.lucky_draw_jobs j join public.lucky_draw_campaigns d on d.id=j.campaign_id
  join public.profiles p on p.id=d.host_user_id where d.drawn_at is null and d.cancelled_at is null
  and j.not_before<=now() and (j.lease_until is null or j.lease_until<now()) order by d.closes_at nulls last,j.not_before,j.campaign_id limit 10 for update of j skip locked loop
  update private.lucky_draw_jobs set lease_token=gen_random_uuid(),lease_until=now()+interval '3 minutes',last_attempt_at=now() where campaign_id=c.campaign_id returning * into job;
  result:=result||jsonb_build_array(jsonb_build_object('campaign_id',c.campaign_id,'owner_id',c.host_user_id,'token',job.lease_token));
 end loop;
 return result;
end $$;
create function private.finish_lucky_draw_job(draw_id uuid,token uuid,success boolean) returns void
language sql security definer set search_path='' as $$
 update private.lucky_draw_jobs set lease_until=null,lease_token=null,not_before=now()+case when success then interval '1 minute' else interval '5 minutes' end,
  last_failure=case when success then null else 'Host key, request budget or upstream log verification unavailable' end
 where campaign_id=draw_id and lease_token=token;
$$;
create function public.claim_lucky_draw_jobs() returns jsonb language sql security invoker set search_path='' as $$select private.claim_lucky_draw_jobs()$$;
create function public.finish_lucky_draw_job(draw_id uuid,token uuid,success boolean) returns void language sql security invoker set search_path='' as $$select private.finish_lucky_draw_job(draw_id,token,success)$$;
revoke all on function private.claim_lucky_draw_jobs(),public.claim_lucky_draw_jobs(),private.finish_lucky_draw_job(uuid,uuid,boolean),public.finish_lucky_draw_job(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function private.claim_lucky_draw_jobs(),public.claim_lucky_draw_jobs(),private.finish_lucky_draw_job(uuid,uuid,boolean),public.finish_lucky_draw_job(uuid,uuid,boolean) to service_role;

-- The worker keeps collecting receive logs while the page is closed, completes
-- final coverage and invokes the idempotent random finalizer. The Vault token
-- stays in the database and is never copied into source or a browser response.
select cron.schedule('process-lucky-draws','* * * * *',$job$
 select net.http_post(url:='https://caxhhhtrlqfuatraamto.supabase.co/functions/v1/process-lucky-draws',
  headers:=jsonb_build_object('Content-Type','application/json','x-job-token',(select decrypted_secret from vault.decrypted_secrets where name='tcc_job_token')),body:='{}'::jsonb,timeout_milliseconds:=90000);
$job$);
