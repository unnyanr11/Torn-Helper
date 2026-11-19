-- Read all 35 recorded high/low ranges together, aligned to the displayed quote.
create function public.read_stock_window_extremes(p_window_minutes integer default 1440,p_as_of timestamptz default null) returns json
language plpgsql stable security invoker set search_path='' as $$
declare anchor timestamptz;
begin
 if p_window_minutes is null or p_window_minutes not in(15,30,60,720,1440,10080) then raise exception 'Unsupported comparison window';end if;
 select provider_at into anchor from public.stock_collection_status where id=1;
 if anchor is null then return json_build_object('provider_at',null,'window_minutes',p_window_minutes,'stocks','[]'::json);end if;
 anchor:=least(anchor,coalesce(p_as_of,anchor));
 return (
  with window_prices as materialized(
   select stock_id,price,observed_at from public.stock_minute_prices
   where observed_at>anchor-make_interval(mins=>p_window_minutes) and observed_at<=anchor
  ),bounds as(
   select stock_id,min(price) low,max(price) high,count(*) observed_points,min(observed_at) first_observed_at
   from window_prices group by stock_id
  ),ranges as(
   select b.stock_id,b.low,b.high,b.observed_points,b.first_observed_at,
    max(p.observed_at) filter(where p.price=b.low) low_at,
    max(p.observed_at) filter(where p.price=b.high) high_at
   from bounds b join window_prices p using(stock_id) group by b.stock_id,b.low,b.high,b.observed_points,b.first_observed_at
  )
  select json_build_object('provider_at',anchor,'window_minutes',p_window_minutes,'stocks',coalesce(json_agg(r order by stock_id),'[]'::json)) from ranges r
 );
end $$;
revoke all on function public.read_stock_window_extremes(integer,timestamptz) from public,anon;
grant execute on function public.read_stock_window_extremes(integer,timestamptz) to authenticated,service_role;
notify pgrst,'reload schema';
