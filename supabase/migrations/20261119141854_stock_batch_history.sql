-- Compact batches load the week once and stream only new minute points afterward.
create or replace function public.read_all_stock_minute_history(p_after bigint default null) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'provider_at',s.provider_at,'backfilled_stocks',s.backfilled_stocks,
  'stocks',coalesce((
   select jsonb_object_agg(stock_id,points)
   from (
    select stock_id,jsonb_agg(jsonb_build_array(extract(epoch from observed_at)::bigint,price,source) order by observed_at) as points
    from public.stock_minute_prices
    where observed_at>greatest(now()-interval '7 days',coalesce(to_timestamp(p_after),now()-interval '7 days'))
    group by stock_id
   ) groups
  ),'{}'::jsonb)
 ) from public.stock_collection_status s where id=1;
$$;
revoke all on function public.read_all_stock_minute_history(bigint) from public,anon;
grant execute on function public.read_all_stock_minute_history(bigint) to authenticated;
notify pgrst,'reload schema';
