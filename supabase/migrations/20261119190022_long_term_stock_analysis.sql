-- Persist a separate daily-horizon model; private jobs use the same shared quote archive.
create table public.stock_long_term_results(
 stock_id smallint primary key check(stock_id between 1 and 35),
 provider_at timestamptz not null,computed_at timestamptz not null default now(),
 forecast jsonb not null check(jsonb_typeof(forecast)='object'),
 points jsonb not null check(jsonb_typeof(points)='array' and jsonb_array_length(points)<=721),
 processing_ms double precision not null check(processing_ms>=0),
 batch_ms double precision not null check(batch_ms>=0)
);
alter table public.stock_long_term_results enable row level security;
revoke all on public.stock_long_term_results from public,anon,authenticated;
grant select on public.stock_long_term_results to authenticated;
grant all on public.stock_long_term_results to service_role;
create policy stock_long_term_read on public.stock_long_term_results for select to authenticated using(true);

create function public.read_stock_long_term_input() returns json language sql stable security invoker set search_path='' as $$
 with anchor as(select provider_at from public.stock_collection_status where id=1),
 closes as materialized(
  select distinct on(stock_id,date_trunc('hour',observed_at)) stock_id,price,observed_at
  from public.stock_minute_prices,anchor
  where observed_at>provider_at-interval '30 days' and observed_at<=provider_at
  order by stock_id,date_trunc('hour',observed_at),observed_at desc
 ),stocks as(
  select stock_id,json_agg(json_build_array(extract(epoch from observed_at)::bigint,price) order by observed_at) points from closes group by stock_id
 ) select json_build_object('provider_at',(select provider_at from anchor),'stocks',coalesce(json_object_agg(stock_id,points),'{}'::json)) from stocks;
$$;
revoke all on function public.read_stock_long_term_input() from public,anon,authenticated;
grant execute on function public.read_stock_long_term_input() to service_role;

create function public.publish_stock_long_term(p_provider_at timestamptz,p_started_at timestamptz,p_results jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 if p_provider_at is null or p_started_at is null or jsonb_typeof(p_results) is distinct from 'array' or jsonb_array_length(p_results)<>35
  or (select count(distinct (e->>'stock_id')::int) from jsonb_array_elements(p_results)e where (e->>'stock_id')::int between 1 and 35)<>35 then raise exception 'Complete 35-stock analysis required';end if;
 insert into public.stock_long_term_results(stock_id,provider_at,computed_at,forecast,points,processing_ms,batch_ms)
 select (e->>'stock_id')::smallint,p_provider_at,clock_timestamp(),(e->'forecast')-'points',e->'forecast'->'points',(e->>'processing_ms')::double precision,greatest(0,extract(epoch from clock_timestamp()-p_started_at)*1000)
 from jsonb_array_elements(p_results)e
 on conflict(stock_id) do update set provider_at=excluded.provider_at,computed_at=excluded.computed_at,forecast=excluded.forecast,points=excluded.points,processing_ms=excluded.processing_ms,batch_ms=excluded.batch_ms
 where stock_long_term_results.provider_at<=excluded.provider_at;
 return true;
end $$;
revoke all on function public.publish_stock_long_term(timestamptz,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.publish_stock_long_term(timestamptz,timestamptz,jsonb) to service_role;

create function private.enqueue_long_term_stock_analysis() returns void language plpgsql security definer set search_path='' as $$
declare token text;
begin
 select decrypted_secret into token from vault.decrypted_secrets where name='tcc_job_token';
 if token is null then raise exception 'Scheduled job token unavailable';end if;
 perform net.http_post(url:='https://caxhhhtrlqfuatraamto.supabase.co/functions/v1/analyze-long-term-stocks',headers:=jsonb_build_object('Content-Type','application/json','x-job-token',token),body:='{}'::jsonb,timeout_milliseconds:=40000);
end $$;
revoke all on function private.enqueue_long_term_stock_analysis() from public,anon,authenticated;
grant execute on function private.enqueue_long_term_stock_analysis() to service_role;
select cron.schedule('long-term-stock-analysis','*/5 * * * *',$job$select private.enqueue_long_term_stock_analysis()$job$);
notify pgrst,'reload schema';

-- Read all 35 recorded high/low ranges together, aligned to the displayed quote.
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
