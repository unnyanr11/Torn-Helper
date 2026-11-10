-- Campaign terms and results are immutable to clients. All transitions lock the
-- campaign row; only the authenticated, verified Torn identity supplies ownership.
create table public.lucky_draw_campaigns (
 id uuid primary key default gen_random_uuid(),
 host_user_id uuid not null references public.profiles(id),
 host_torn_id bigint not null, host_name text not null,
 title text not null, description text not null default '',
 entry_item text not null, quantity_per_ticket integer not null check(quantity_per_ticket between 1 and 1000000),
 max_tickets_per_player integer not null check(max_tickets_per_player between 1 and 10000),
 prize_mode text not null check(prize_mode in ('pool','fixed')),
 prizes jsonb not null, closes_at timestamptz not null,
 created_at timestamptz not null default now(), drawn_at timestamptz,
 cancelled_at timestamptz, cancellation_reason text,
 pool_quantity bigint, eligible_players integer, eligible_tickets bigint
);
create index lucky_draw_campaigns_created on public.lucky_draw_campaigns(created_at desc);
create index lucky_draw_campaigns_host on public.lucky_draw_campaigns(host_user_id);
create table private.lucky_draw_submissions (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.lucky_draw_campaigns(id),
 host_user_id uuid not null references public.profiles(id), user_id uuid not null references public.profiles(id),
 torn_id bigint not null, player_name text not null, quantity integer not null check(quantity between 1 and 1000000),
 tickets integer not null check(tickets between 1 and 10000), transfer_reference text not null,
 evidence text not null, status text not null default 'pending' check(status in ('pending','approved','rejected')),
 refund_reference text, refunded_at timestamptz,
 review_note text, created_at timestamptz not null default now(), reviewed_at timestamptz,
 unique(host_user_id, transfer_reference)
);
create index lucky_draw_submissions_campaign on private.lucky_draw_submissions(campaign_id,status,user_id);
create index lucky_draw_submissions_user on private.lucky_draw_submissions(user_id);
create table public.lucky_draw_winners (
 campaign_id uuid not null references public.lucky_draw_campaigns(id), rank integer not null,
 user_id uuid not null references public.profiles(id), torn_id bigint not null, player_name text not null,
 prize_item text not null, quantity bigint not null check(quantity>=0), percentage numeric,
 payment_reference text, paid_at timestamptz, received_at timestamptz,
 primary key(campaign_id,rank), unique(campaign_id,user_id)
);
create index lucky_draw_winners_user on public.lucky_draw_winners(user_id);
alter table public.lucky_draw_campaigns enable row level security;
alter table private.lucky_draw_submissions enable row level security;
alter table public.lucky_draw_winners enable row level security;
revoke all on public.lucky_draw_campaigns,private.lucky_draw_submissions,public.lucky_draw_winners from public,anon,authenticated;
grant select on public.lucky_draw_campaigns,public.lucky_draw_winners to authenticated;
create policy signed_in_read on public.lucky_draw_campaigns for select to authenticated using((select auth.uid()) is not null);
create policy signed_in_read on public.lucky_draw_winners for select to authenticated using((select auth.uid()) is not null);

create function private.lucky_draw_action(action text, campaign uuid default null, payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); identity_row record; c public.lucky_draw_campaigns;
 s private.lucky_draw_submissions; p jsonb; tiers jsonb:='[]'; total numeric:=0;
 n integer; q integer; cap integer; ticket_count integer; used bigint; pool bigint; players integer; rank_no integer;
 result jsonb; winner record; mode text; deadline timestamptz;
begin
 if actor is null then raise exception 'Sign in with Torn first'; end if;
 select torn_id,coalesce(torn_name,'Player '||torn_id) as name into identity_row
 from public.linked_torn_accounts where user_id=actor and revoked_at is null;
 if not found then raise exception 'A verified Torn account is required'; end if;
 if payload is null or jsonb_typeof(payload)<>'object' then raise exception 'Invalid campaign request'; end if;
 if action='create' then
  if length(btrim(coalesce(payload->>'title',''))) not between 3 and 120 or length(coalesce(payload->>'description',''))>4000
   or length(btrim(coalesce(payload->>'entry_item',''))) not between 1 and 100 then raise exception 'Enter a title, entry item and valid description'; end if;
  q:=(payload->>'quantity_per_ticket')::integer; cap:=(payload->>'max_tickets_per_player')::integer;
  mode:=payload->>'prize_mode'; deadline:=(payload->>'closes_at')::timestamptz;
  if q is null or q not between 1 and 1000000 or cap is null or cap not between 1 and 10000
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
     or (p->>'quantity')::numeric not between 1 and 1000000 or (p->>'quantity')::numeric<>trunc((p->>'quantity')::numeric)
     then raise exception 'Each fixed prize needs an item and whole positive quantity'; end if;
    tiers:=tiers||jsonb_build_array(jsonb_build_object('item',btrim(p->>'item'),'quantity',(p->>'quantity')::integer));
   end if;
  end loop;
  if total>100 then raise exception 'Prize percentages cannot exceed 100 in total'; end if;
  insert into public.lucky_draw_campaigns(host_user_id,host_torn_id,host_name,title,description,entry_item,quantity_per_ticket,max_tickets_per_player,prize_mode,prizes,closes_at)
   values(actor,identity_row.torn_id,identity_row.name,btrim(payload->>'title'),coalesce(payload->>'description',''),btrim(payload->>'entry_item'),q,cap,mode,tiers,deadline) returning * into c;
  return to_jsonb(c);
 end if;
 select * into c from public.lucky_draw_campaigns where id=campaign for update;
 if not found then raise exception 'Campaign not found'; end if;
 if action='details' then
  select jsonb_build_object('campaign',to_jsonb(c),'is_host',c.host_user_id=actor,
   'submissions',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from private.lucky_draw_submissions e where e.campaign_id=c.id and (c.host_user_id=actor or e.user_id=actor)),'[]'::jsonb),
   'pool_quantity',coalesce((select sum(e.quantity) from private.lucky_draw_submissions e where e.campaign_id=c.id and status='approved'),0),
   'eligible_players',(select count(distinct e.user_id) from private.lucky_draw_submissions e where e.campaign_id=c.id and status='approved'),
   'pending_count',(select count(*) from private.lucky_draw_submissions e where e.campaign_id=c.id and status='pending'),
   'winners',coalesce((select jsonb_agg(to_jsonb(w) order by w.rank) from public.lucky_draw_winners w where w.campaign_id=c.id),'[]'::jsonb)) into result;
  return result;
 end if;
 if action='submit' then
  if c.host_user_id=actor then raise exception 'Hosts cannot enter their own draw'; end if;
  if c.cancelled_at is not null or c.drawn_at is not null or now()>=c.closes_at then raise exception 'Entries are closed'; end if;
  q:=(payload->>'quantity')::integer;
  if q is null or q not between 1 and 1000000 or q%c.quantity_per_ticket<>0 then raise exception 'Send a whole multiple of the entry quantity'; end if;
  ticket_count:=q/c.quantity_per_ticket;
  select coalesce(sum(tickets),0) into used from private.lucky_draw_submissions where campaign_id=c.id and user_id=actor and status<>'rejected';
  if used+ticket_count>c.max_tickets_per_player then raise exception 'This exceeds the per-player ticket limit'; end if;
  if length(btrim(coalesce(payload->>'transfer_reference',''))) not between 3 and 200
   or length(btrim(coalesce(payload->>'evidence',''))) not between 5 and 2000 then raise exception 'Add a unique transfer reference and transfer evidence'; end if;
  insert into private.lucky_draw_submissions(campaign_id,host_user_id,user_id,torn_id,player_name,quantity,tickets,transfer_reference,evidence)
   values(c.id,c.host_user_id,actor,identity_row.torn_id,identity_row.name,q,ticket_count,btrim(payload->>'transfer_reference'),btrim(payload->>'evidence')) returning * into s;
  return to_jsonb(s);
 end if;
 if action in ('approve','reject') then
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
  select count(distinct user_id),coalesce(sum(quantity),0),coalesce(sum(tickets),0) into players,pool,used
   from private.lucky_draw_submissions where campaign_id=c.id and status='approved';
  if players<jsonb_array_length(c.prizes) then raise exception 'There must be at least one distinct eligible player per prize'; end if;
  rank_no:=0;
  -- Exponential weighted sampling without replacement. Each approved ticket has
  -- equal weight, and a player can win only once. Randomness is server pgcrypto.
  for winner in
   select user_id,min(torn_id) as torn_id,min(player_name) as player_name from private.lucky_draw_submissions where campaign_id=c.id and status='approved'
   group by user_id
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
  update public.lucky_draw_winners set received_at=now() where campaign_id=c.id and rank=(payload->>'rank')::integer and user_id=actor and paid_at is not null and received_at is null;
  if not found then raise exception 'Only the winning player can confirm a sent prize'; end if;
  return jsonb_build_object('received',true);
 end if;
 raise exception 'Unknown campaign action';
end $$;
create function public.lucky_draw_action(action text,campaign uuid default null,payload jsonb default '{}') returns jsonb
 language sql security invoker set search_path='' as $$select private.lucky_draw_action(action,campaign,payload)$$;
revoke all on function private.lucky_draw_action(text,uuid,jsonb),public.lucky_draw_action(text,uuid,jsonb) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.lucky_draw_action(text,uuid,jsonb),public.lucky_draw_action(text,uuid,jsonb) to authenticated;
