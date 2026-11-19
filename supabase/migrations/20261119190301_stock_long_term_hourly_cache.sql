-- Reuse hourly closes so the monthly batch does not rescan every stored minute.
create table private.stock_hourly_closes(
 stock_id smallint not null check(stock_id between 1 and 35),hour_at timestamptz not null,
 observed_at timestamptz not null,price numeric not null check(price>0),primary key(stock_id,hour_at)
);
alter table private.stock_hourly_closes enable row level security;
revoke all on private.stock_hourly_closes from public,anon,authenticated;
grant all on private.stock_hourly_closes to service_role;
create policy stock_hourly_service on private.stock_hourly_closes to service_role using(true) with check(true);

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
 delete from private.stock_hourly_closes where observed_at<=anchor-interval '30 days';
 return (select json_build_object('provider_at',anchor,'stocks',coalesce(json_object_agg(stock_id,points),'{}'::json)) from(
  select stock_id,json_agg(json_build_array(extract(epoch from observed_at)::bigint,price) order by observed_at) points
  from private.stock_hourly_closes where observed_at>anchor-interval '30 days' and observed_at<=anchor group by stock_id
 ) stocks);
end $$;
revoke all on function public.read_stock_long_term_input() from public,anon,authenticated;
grant execute on function public.read_stock_long_term_input() to service_role;
notify pgrst,'reload schema';
