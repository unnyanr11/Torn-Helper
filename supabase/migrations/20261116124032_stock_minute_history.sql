-- Shared market observations, never keys, holdings, or other private player data.
create table public.stock_minute_prices (
 stock_id smallint not null check(stock_id between 1 and 35),
 observed_at timestamptz not null check(mod(extract(epoch from observed_at)::numeric,60)=0),
 price numeric(18,6) not null check(price>0 and price<1000000000000),
 total_shares bigint check(total_shares>=0),
 source text not null default 'Tornsy' check(source='Tornsy'),
 collected_at timestamptz not null default now(),
 primary key(stock_id,observed_at)
);
create index stock_minutes_retention on public.stock_minute_prices(observed_at);
alter table public.stock_minute_prices enable row level security;
revoke all on public.stock_minute_prices from public,anon,authenticated;
grant select on public.stock_minute_prices to authenticated;
grant all on public.stock_minute_prices to service_role;
create policy stock_minutes_read on public.stock_minute_prices for select to authenticated using(true);
create table public.stock_collection_status (
 id integer primary key check(id=1), last_attempt timestamptz, last_success timestamptz,
 provider_at timestamptz, rows_written integer not null default 0,
 message text not null default 'Waiting for first collection',
 backfilled_stocks integer not null default 0
);
insert into public.stock_collection_status(id) values(1);
alter table public.stock_collection_status enable row level security;
revoke all on public.stock_collection_status from public,anon,authenticated;
grant select on public.stock_collection_status to authenticated;
grant all on public.stock_collection_status to service_role;
create policy stock_collection_read on public.stock_collection_status for select to authenticated using(true);
create table private.stock_collection_control (
 id integer primary key check(id=1), lease uuid, lease_until timestamptz,
 last_slot timestamptz, backfill_id integer not null default 1 check(backfill_id between 1 and 36)
);
insert into private.stock_collection_control(id) values(1);
alter table private.stock_collection_control enable row level security;
revoke all on private.stock_collection_control from public,anon,authenticated;
grant all on private.stock_collection_control to service_role;
create policy stock_collection_service on private.stock_collection_control to service_role using(true) with check(true);
create function public.claim_stock_collection() returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.stock_collection_control; token uuid:=gen_random_uuid(); slot timestamptz:=date_trunc('minute',now());
begin
 select * into c from private.stock_collection_control where id=1 for update;
 if c.last_slot=slot or c.lease_until>now() then return null; end if;
 update private.stock_collection_control set lease=token,lease_until=now()+interval '55 seconds',last_slot=slot where id=1;
 update public.stock_collection_status set last_attempt=now() where id=1;
 return jsonb_build_object('lease',token,'backfill_id',case when c.backfill_id<=35 then c.backfill_id else 1+mod(extract(epoch from slot)::bigint/60,35) end);
end $$;
create function public.finish_stock_collection(p_lease uuid,p_provider_at timestamptz,p_points jsonb,p_backfilled boolean default false,p_error text default null) returns integer language plpgsql security definer set search_path='' as $$
declare c private.stock_collection_control; inserted integer; point jsonb; ts timestamptz;
begin
 select * into c from private.stock_collection_control where id=1 for update;
 if p_lease is null or c.lease is null or c.lease is distinct from p_lease or c.lease_until<now() then raise exception 'Collection lease expired'; end if;
 if p_error is not null then
  update public.stock_collection_status set message='Provider refresh failed; previous observations retained',rows_written=0 where id=1;
  update private.stock_collection_control set lease=null,lease_until=null where id=1;
  return 0;
 end if;
 if p_provider_at is null or p_provider_at<now()-interval '3 minutes' or p_provider_at>now()+interval '30 seconds' or mod(extract(epoch from p_provider_at)::numeric,60)<>0 then raise exception 'Provider timestamp is stale or invalid'; end if;
 if jsonb_typeof(p_points) is distinct from 'array' or jsonb_array_length(p_points) not between 35 and 2035 then raise exception 'Incomplete stock batch'; end if;
 if (select count(distinct (e->>'stock_id')::integer) from jsonb_array_elements(p_points)e where (e->>'timestamp')::bigint=extract(epoch from p_provider_at)::bigint)<>35 then raise exception 'All 35 stocks required'; end if;
 for point in select * from jsonb_array_elements(p_points) loop
  ts:=to_timestamp((point->>'timestamp')::bigint);
  if ts<now()-interval '30 days' or ts>p_provider_at or mod(extract(epoch from ts)::numeric,60)<>0 or jsonb_typeof(point->'price') is distinct from 'number' or jsonb_typeof(point->'stock_id') is distinct from 'number' then raise exception 'Invalid minute observation'; end if;
 end loop;
 insert into public.stock_minute_prices(stock_id,observed_at,price,total_shares)
 select (e->>'stock_id')::smallint,to_timestamp((e->>'timestamp')::bigint),(e->>'price')::numeric,(e->>'total_shares')::bigint from jsonb_array_elements(p_points)e
 on conflict(stock_id,observed_at) do nothing;
 get diagnostics inserted=row_count;
 update public.stock_collection_status set last_success=now(),provider_at=p_provider_at,rows_written=inserted,message=case when c.backfill_id<35 then 'Collecting all stocks; warming up minute history' else 'Minute collection active' end,backfilled_stocks=least(35,c.backfill_id-1+case when p_backfilled then 1 else 0 end) where id=1;
 update private.stock_collection_control set lease=null,lease_until=null,backfill_id=least(36,backfill_id+case when p_backfilled then 1 else 0 end) where id=1;
 return inserted;
end $$;
create function public.read_stock_minute_history(p_stock_id integer) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('timestamp',extract(epoch from observed_at)::bigint,'price',price,'source',source) order by observed_at),'[]'::jsonb)
 from (select observed_at,price,source from public.stock_minute_prices where stock_id=p_stock_id order by observed_at desc limit 2000) points;
$$;
revoke all on function public.claim_stock_collection(),public.finish_stock_collection(uuid,timestamptz,jsonb,boolean,text),public.read_stock_minute_history(integer) from public,anon,authenticated;
grant execute on function public.claim_stock_collection(),public.finish_stock_collection(uuid,timestamptz,jsonb,boolean,text) to service_role;
grant execute on function public.read_stock_minute_history(integer) to authenticated;
select cron.schedule('collect-stock-minutes','* * * * *',$job$
 select net.http_post(url:='https://caxhhhtrlqfuatraamto.supabase.co/functions/v1/collect-stock-minutes',headers:=jsonb_build_object('Content-Type','application/json','x-job-token',(select decrypted_secret from vault.decrypted_secrets where name='tcc_job_token')),body:='{}'::jsonb,timeout_milliseconds:=50000);
$job$);
-- Bounded rolling archive; export minute rows to keep longer offline histories.
select cron.schedule('prune-stock-minutes','17 3 * * *',$job$delete from public.stock_minute_prices where observed_at<now()-interval '30 days';$job$);
notify pgrst,'reload schema';
