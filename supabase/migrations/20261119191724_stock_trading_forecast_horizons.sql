-- Cache each forecast horizon independently; no daily result is relabelled as a weekly forecast.
create table public.stock_horizon_results(
 stock_id smallint not null check(stock_id between 1 and 35),
 horizon_hours smallint not null check(horizon_hours in(1,3,6,12,18,24,168,336,504,672)),
 provider_at timestamptz not null,computed_at timestamptz not null default now(),
 forecast jsonb not null check(jsonb_typeof(forecast)='object'),
 processing_ms double precision not null check(processing_ms>=0),batch_ms double precision not null check(batch_ms>=0),
 primary key(stock_id,horizon_hours)
);
alter table public.stock_horizon_results enable row level security;
revoke all on public.stock_horizon_results from public,anon,authenticated;
grant select on public.stock_horizon_results to authenticated;
grant all on public.stock_horizon_results to service_role;
create policy stock_horizons_read on public.stock_horizon_results for select to authenticated using(true);

create function public.publish_stock_horizons(p_provider_at timestamptz,p_started_at timestamptz,p_results jsonb,p_charts jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 if p_provider_at is null or p_started_at is null or jsonb_typeof(p_results) is distinct from 'array' or jsonb_array_length(p_results)<>350
  or (select count(distinct ((e->>'stock_id')::int,(e->>'horizon_hours')::int)) from jsonb_array_elements(p_results)e where (e->>'stock_id')::int between 1 and 35 and (e->>'horizon_hours')::int in(1,3,6,12,18,24,168,336,504,672))<>350
 then raise exception 'Complete 350-forecast batch required';end if;
 if exists(select 1 from jsonb_array_elements(p_results)e where (e->'forecast'->>'horizonHours')::int is distinct from (e->>'horizon_hours')::int) then raise exception 'Forecast horizon mismatch';end if;
 insert into public.stock_horizon_results(stock_id,horizon_hours,provider_at,computed_at,forecast,processing_ms,batch_ms)
 select (e->>'stock_id')::smallint,(e->>'horizon_hours')::smallint,p_provider_at,clock_timestamp(),(e->'forecast')-'points',(e->>'processing_ms')::double precision,greatest(0,extract(epoch from clock_timestamp()-p_started_at)*1000)
 from jsonb_array_elements(p_results)e
 on conflict(stock_id,horizon_hours) do update set provider_at=excluded.provider_at,computed_at=excluded.computed_at,forecast=excluded.forecast,processing_ms=excluded.processing_ms,batch_ms=excluded.batch_ms
 where stock_horizon_results.provider_at<=excluded.provider_at;
 -- The existing chart cache remains one row per stock, limited to the latest 30 days.
 perform public.publish_stock_long_term(p_provider_at,p_started_at,p_charts);
 return true;
end $$;
revoke all on function public.publish_stock_horizons(timestamptz,timestamptz,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.publish_stock_horizons(timestamptz,timestamptz,jsonb,jsonb) to service_role;

create or replace function public.read_stock_long_term_input() returns json language plpgsql volatile security invoker set search_path='' as $$
declare anchor timestamptz;cutoff timestamptz;first_minute timestamptz;first_hour timestamptz;
begin
 select provider_at into anchor from public.stock_collection_status where id=1;
 if anchor is null then return json_build_object('provider_at',null,'stocks','{}'::json);end if;
 select min(observed_at) into first_minute from public.stock_minute_prices where observed_at>anchor-interval '30 days';
 select min(hour_at),max(observed_at)-interval '1 hour' into first_hour,cutoff from private.stock_hourly_closes;
 if cutoff is null or first_minute<first_hour then cutoff:=anchor-interval '30 days';end if;
 cutoff:=greatest(cutoff,anchor-interval '30 days');
 insert into private.stock_hourly_closes(stock_id,hour_at,observed_at,price)
 select distinct on(stock_id,date_trunc('hour',observed_at)) stock_id,date_trunc('hour',observed_at),observed_at,price
 from public.stock_minute_prices where observed_at>cutoff and observed_at<=anchor
 order by stock_id,date_trunc('hour',observed_at),observed_at desc
 on conflict(stock_id,hour_at) do update set observed_at=excluded.observed_at,price=excluded.price
 where stock_hourly_closes.observed_at<=excluded.observed_at;
 delete from private.stock_hourly_closes where observed_at<=anchor-interval '120 days';
 return (select json_build_object('provider_at',anchor,'stocks',coalesce(json_object_agg(stock_id,points),'{}'::json)) from(
  select stock_id,json_agg(json_build_array(extract(epoch from observed_at)::bigint,price) order by observed_at) points
  from private.stock_hourly_closes where observed_at>anchor-interval '120 days' and observed_at<=anchor group by stock_id
 ) stocks);
end $$;
revoke all on function public.read_stock_long_term_input() from public,anon,authenticated;
grant execute on function public.read_stock_long_term_input() to service_role;
notify pgrst,'reload schema';

create or replace function public.read_stock_window_extremes(p_window_minutes integer default 1440,p_as_of timestamptz default null) returns json
language plpgsql stable security invoker set search_path='' as $$
declare anchor timestamptz;
begin
 if p_window_minutes is null or p_window_minutes not in(15,30,60,720,1440,10080,43200) then raise exception 'Unsupported comparison window';end if;
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
   select b.stock_id,b.low,b.high,b.observed_points,b.first_observed_at,max(p.price) filter(where p.observed_at=b.first_observed_at) open,
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
