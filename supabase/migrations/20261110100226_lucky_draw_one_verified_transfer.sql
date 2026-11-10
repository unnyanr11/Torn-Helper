-- Fail closed: this rule change is authorized only for future campaigns.
-- Prevent concurrent campaign creation while confirming no published rules or
-- entry records can be affected. This migration performs no row updates/deletes.
lock table public.lucky_draw_campaigns,private.lucky_draw_submissions,private.lucky_draw_receipts in share row exclusive mode;
do $$ begin
 if exists(select 1 from public.lucky_draw_campaigns) or exists(select 1 from private.lucky_draw_submissions) or exists(select 1 from private.lucky_draw_receipts)
 then raise exception 'Campaign data exists: stop and review rule changes before applying this migration'; end if;
end $$;
-- One received transfer = one entry. Amounts are retained in full for the prize pool.
-- New entries must come from the authenticated host log verifier; manual claims cannot be approved.
create or replace function private.process_lucky_draw_receipts(draw_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c public.lucky_draw_campaigns; r private.lucky_draw_receipts; linked uuid; pname text; used bigint; amount bigint; item_id integer; proof jsonb; lvl integer; fac bigint; ticket_n integer; v_reason text; entry_id uuid;
begin
 select * into c from public.lucky_draw_campaigns where id=draw_id for update;
 if exists(select 1 from private.lucky_draw_sync where campaign_id=c.id and next_parameters is not null) then return;end if;
 select id into item_id from public.torn_item_catalogue where lower(name)=lower(c.entry_item) limit 1;
 for r in select * from private.lucky_draw_receipts where campaign_id=c.id and state in ('detected','awaiting_eligibility') order by received_at,log_id for update loop
  v_reason:=null;lvl:=null;fac:=null;linked:=null;entry_id:=null;
  select user_id,coalesce(torn_name,'Player '||torn_id) into linked,pname from public.linked_torn_accounts where torn_id=r.sender_torn_id and revoked_at is null;
  pname:=coalesce(pname,'Player '||r.sender_torn_id);
  if c.entry_item='Cash' and r.kind='cash' then select coalesce(sum((a->>'quantity')::bigint),0) into amount from jsonb_array_elements(r.assets) a;
  elsif r.kind='item' then select coalesce(sum((a->>'quantity')::bigint),0) into amount from jsonb_array_elements(r.assets) a where (a->>'item_id')::integer=item_id;
  else amount:=0;end if;
  if c.entry_verification<>'token' then v_reason:='Manual-entry campaign: use the existing submission review';
  elsif c.cancelled_at is not null then v_reason:='Campaign cancelled; resolve or return this transfer';
  elsif c.drawn_at is not null then v_reason:='Draw already final; transfer was not counted';
  elsif r.sender_torn_id=c.host_torn_id then v_reason:='Hosts cannot enter their own draw';
  elsif r.received_at<to_timestamp(floor(extract(epoch from c.created_at))) or r.received_at>=c.closes_at then v_reason:='Transfer outside the entry window';
  elsif amount<=0 then v_reason:='Transfer does not contain the required entry asset';
  elsif amount<c.quantity_per_ticket then v_reason:='Transfer is below the minimum entry amount';
  end if;
  update private.lucky_draw_receipts set entry_quantity=amount where host_user_id=r.host_user_id and log_id=r.log_id;
  if v_reason is not null then update private.lucky_draw_receipts set state='ineligible',reason=v_reason where host_user_id=r.host_user_id and log_id=r.log_id;continue;end if;
  if c.audience='new_players' then
   select tc.payload into proof from public.torn_data_cache tc where user_id=linked and endpoint_id='v2-user-profile' and parameters='{}'::jsonb and fetched_at between now()-interval '5 minutes' and now() order by fetched_at desc limit 1;
   lvl:=(proof#>>'{profile,level}')::integer;
   if (proof#>>'{profile,id}')::bigint is distinct from r.sender_torn_id or lvl is null then v_reason:='Sender must sign in and verify level eligibility';
   elsif lvl not between 1 and 15 then v_reason:='Verified level does not meet the level 1–15 rule';end if;
  elsif c.audience='faction' then
   select tc.payload into proof from public.torn_data_cache tc where user_id=linked and endpoint_id='v2-user-faction' and parameters='{}'::jsonb and fetched_at between now()-interval '5 minutes' and now() order by fetched_at desc limit 1;
   fac:=(proof#>>'{faction,id}')::bigint;
   if fac is distinct from c.faction_id then v_reason:='Sender must sign in and verify membership of the campaign faction';end if;
  end if;
  if v_reason is not null then update private.lucky_draw_receipts set state='awaiting_eligibility',reason=v_reason where host_user_id=r.host_user_id and log_id=r.log_id;continue;end if;
  select coalesce(sum(tickets),0) into used from private.lucky_draw_submissions where campaign_id=c.id and torn_id=r.sender_torn_id and status<>'rejected';
  ticket_n:=1; -- One verified transfer is one entry, regardless of the amount received.
  if used+ticket_n>c.max_tickets_per_player then
   update private.lucky_draw_receipts set state='ineligible',reason='Combined transfers exceed the per-player entry limit' where host_user_id=r.host_user_id and log_id=r.log_id;continue;
  end if;
  if coalesce((select sum(quantity) from private.lucky_draw_submissions where campaign_id=c.id and status='approved'),0)+amount>9007199254740991 then raise exception 'Campaign pool exceeds supported whole-number precision';end if;
  insert into private.lucky_draw_submissions(campaign_id,host_user_id,user_id,torn_id,player_name,quantity,tickets,transfer_reference,evidence,status,reviewed_at,review_note,verified_level,verified_faction_id)
   values(c.id,c.host_user_id,linked,r.sender_torn_id,pname,amount,ticket_n,r.log_id,'Verified Torn received-transfer log; campaign token matched','approved',now(),'Automatically verified received transfer',lvl,fac)
   on conflict(host_user_id,transfer_reference) do nothing returning id into entry_id;
  update private.lucky_draw_receipts set state=case when entry_id is not null then 'accepted' else 'ineligible' end,
   reason=case when entry_id is not null then 'Verified received transfer' else 'Transfer reference was already used' end,
   tickets=case when entry_id is not null then ticket_n else 0 end,submission_id=entry_id
   where host_user_id=r.host_user_id and log_id=r.log_id;
 end loop;
end $$;

create or replace function private.lucky_draw_action(action text, campaign uuid default null, payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); identity_row record; c public.lucky_draw_campaigns;
 s private.lucky_draw_submissions; p jsonb; tiers jsonb:='[]'; total numeric:=0;
 n integer; q bigint; cap integer; ticket_count integer; used bigint; pool bigint; players integer; rank_no integer;
 result jsonb; winner record; mode text; deadline timestamptz;
 audience_value text; faction_value bigint; level_value integer; proof jsonb;
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
  mode:=payload->>'prize_mode'; deadline:=(payload->>'closes_at')::timestamptz;
  if q is null or q not between 1 and 1000000000000 or cap is null or cap not between 1 and 10000
   or mode is null or mode not in ('pool','fixed') or deadline is null or deadline<=now() or deadline>now()+interval '366 days'
   then raise exception 'Check entry quantity, ticket limit and closing date (within 366 days)'; end if;
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
  insert into public.lucky_draw_campaigns(host_user_id,host_torn_id,host_name,title,description,entry_item,quantity_per_ticket,max_tickets_per_player,prize_mode,prizes,closes_at,audience,faction_id,entry_verification)
   values(actor,identity_row.torn_id,identity_row.name,btrim(payload->>'title'),coalesce(payload->>'description',''),btrim(payload->>'entry_item'),q,cap,mode,tiers,deadline,audience_value,faction_value,'token') returning * into c;
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
  select jsonb_build_object('campaign',to_jsonb(c),'is_host',c.host_user_id=actor,'viewer_torn_id',identity_row.torn_id,
   'receipt_data',private.lucky_draw_receipt_page(c.id,actor,0),
   'sync',case when c.host_user_id=actor then (select jsonb_build_object('checked_through',checked_through,'has_more',next_parameters is not null,'pages',pages) from private.lucky_draw_sync where campaign_id=c.id) end,
   'entry_count',(select coalesce(sum(tickets),0) from private.lucky_draw_submissions where campaign_id=c.id and status='approved'),
   'submissions',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from private.lucky_draw_submissions e where e.campaign_id=c.id and (c.host_user_id=actor or e.torn_id=identity_row.torn_id)),'[]'::jsonb),
   'pool_quantity',coalesce((select sum(e.quantity) from private.lucky_draw_submissions e where e.campaign_id=c.id and status='approved'),0),
   'eligible_players',(select count(distinct e.torn_id) from private.lucky_draw_submissions e where e.campaign_id=c.id and status='approved'),
   'pending_count',(select count(*) from private.lucky_draw_submissions e where e.campaign_id=c.id and status='pending'),
   'winners',coalesce((select jsonb_agg(to_jsonb(w) order by w.rank) from public.lucky_draw_winners w where w.campaign_id=c.id),'[]'::jsonb)) into result;
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
  if c.host_user_id<>actor then raise exception 'Only the host can draw winners'; end if;
  if c.cancelled_at is not null then raise exception 'Campaign cancelled'; end if;
  if c.drawn_at is not null then raise exception 'The draw is already final; rerolls are disabled'; end if;
  if now()<c.closes_at then raise exception 'Wait until the entry deadline'; end if;
  if exists(select 1 from private.lucky_draw_submissions where campaign_id=c.id and status='pending') then raise exception 'Review every pending entry before drawing'; end if;
  select count(distinct torn_id),coalesce(sum(quantity),0),coalesce(sum(tickets),0) into players,pool,used
   from private.lucky_draw_submissions where campaign_id=c.id and status='approved';
  if players<jsonb_array_length(c.prizes) then raise exception 'There must be at least one distinct eligible player per prize'; end if;
  if c.entry_verification='token' then
   if coalesce((select checked_through from private.lucky_draw_sync where campaign_id=c.id),0)<ceil(extract(epoch from c.closes_at)) then raise exception 'Finish syncing host received logs through the entry deadline before drawing'; end if;
   if exists(select 1 from private.lucky_draw_receipts where campaign_id=c.id and state='awaiting_eligibility') then raise exception 'Resolve received transfers awaiting eligibility before drawing'; end if;
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
   insert into public.lucky_draw_winners(campaign_id,rank,user_id,torn_id,player_name,prize_item,quantity,percentage)
    values(c.id,rank_no,winner.user_id,winner.torn_id,winner.player_name,
     case when c.prize_mode='pool' then c.entry_item else p->>'item' end,
     case when c.prize_mode='pool' then floor(pool*(p->>'percentage')::numeric/100)::bigint else (p->>'quantity')::bigint end,
     case when c.prize_mode='pool' then (p->>'percentage')::numeric end);
  end loop;
  update public.lucky_draw_campaigns set drawn_at=now(),pool_quantity=pool,eligible_players=players,eligible_tickets=used where id=c.id;
  return jsonb_build_object('drawn',true);
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
  if c.host_user_id<>actor then raise exception 'Only the host can record payouts'; end if;
  if length(btrim(coalesce(payload->>'reference',''))) not between 3 and 200 then raise exception 'Enter the payout transfer reference'; end if;
  update public.lucky_draw_winners set payment_reference=btrim(payload->>'reference'),paid_at=now()
   where campaign_id=c.id and rank=(payload->>'rank')::integer and paid_at is null;
  if not found then raise exception 'Prize is missing or already marked sent'; end if;
  return jsonb_build_object('paid',true);
 end if;
 if action='received' then
  update public.lucky_draw_winners set received_at=now() where campaign_id=c.id and rank=(payload->>'rank')::integer and torn_id=identity_row.torn_id and paid_at is not null and received_at is null;
  if not found then raise exception 'Only the winning player can confirm a sent prize'; end if;
  return jsonb_build_object('received',true);
 end if;
 raise exception 'Unknown campaign action';
end $$;
