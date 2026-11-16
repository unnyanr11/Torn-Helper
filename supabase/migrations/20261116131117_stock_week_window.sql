create or replace function public.claim_stock_collection() returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.stock_collection_control; token uuid:=gen_random_uuid(); slot timestamptz:=date_trunc('minute',now());
begin
 select * into c from private.stock_collection_control where id=1 for update;
 if c.last_slot=slot or c.lease_until>now() then return null; end if;
 update private.stock_collection_control set lease=token,lease_until=now()+interval '55 seconds',last_slot=slot where id=1;
 update public.stock_collection_status set last_attempt=now() where id=1;
 return jsonb_build_object('lease',token,'full_week',c.backfill_id<=35,'backfill_id',case when c.backfill_id<=35 then c.backfill_id else 1+mod(extract(epoch from slot)::bigint/60,35) end);
end $$;
create or replace function public.finish_stock_collection(p_lease uuid,p_provider_at timestamptz,p_points jsonb,p_backfilled boolean default false,p_error text default null) returns integer language plpgsql security definer set search_path='' as $$
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
 if jsonb_typeof(p_points) is distinct from 'array' or jsonb_array_length(p_points) not between 35 and 10115 then raise exception 'Incomplete stock batch'; end if;
 if (select count(distinct (e->>'stock_id')::integer) from jsonb_array_elements(p_points)e where (e->>'timestamp')::bigint=extract(epoch from p_provider_at)::bigint)<>35 then raise exception 'All 35 stocks required'; end if;
 for point in select * from jsonb_array_elements(p_points) loop
  ts:=to_timestamp((point->>'timestamp')::bigint);
  if ts<now()-interval '30 days' or ts>p_provider_at or mod(extract(epoch from ts)::numeric,60)<>0 or jsonb_typeof(point->'price') is distinct from 'number' or jsonb_typeof(point->'stock_id') is distinct from 'number' then raise exception 'Invalid minute observation'; end if;
 end loop;
 insert into public.stock_minute_prices(stock_id,observed_at,price,total_shares)
 select (e->>'stock_id')::smallint,to_timestamp((e->>'timestamp')::bigint),(e->>'price')::numeric,(e->>'total_shares')::bigint from jsonb_array_elements(p_points)e
 on conflict(stock_id,observed_at) do nothing;
 get diagnostics inserted=row_count;
 update public.stock_collection_status set last_success=now(),provider_at=p_provider_at,rows_written=inserted,message=case when c.backfill_id<35 then 'Collecting all stocks; warming up seven-day history' else 'Minute collection active' end,backfilled_stocks=least(35,c.backfill_id-1+case when p_backfilled then 1 else 0 end) where id=1;
 update private.stock_collection_control set lease=null,lease_until=null,backfill_id=least(36,backfill_id+case when p_backfilled then 1 else 0 end) where id=1;
 return inserted;
end $$;
create or replace function public.read_stock_minute_history(p_stock_id integer) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('timestamp',extract(epoch from observed_at)::bigint,'price',price,'source',source) order by observed_at),'[]'::jsonb)
 from (select observed_at,price,source from public.stock_minute_prices where stock_id=p_stock_id and observed_at>now()-interval '7 days' order by observed_at desc limit 10080) points;
$$;

-- Start a bounded seven-day warmup; prior observations and permissions are retained.
update private.stock_collection_control set backfill_id=1,lease=null,lease_until=null,last_slot=null where id=1;
update public.stock_collection_status set backfilled_stocks=0,message='Warming up seven-day history' where id=1;
notify pgrst,'reload schema';
