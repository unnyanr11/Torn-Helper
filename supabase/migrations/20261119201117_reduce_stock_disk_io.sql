-- The UI now uses 350 hourly/weekly forecasts, not the retired 1/5/15/60-minute models.
-- Disable only the legacy dispatcher; keep current collection, forecasts and retention jobs.
select cron.alter_job(jobid,active:=false) from cron.job where jobname='stock-analysis-batches';
drop trigger if exists stock_inference_batch on public.stock_collection_status;
drop trigger if exists stock_batch_analysis on public.stock_collection_status;

-- One ordered index lookup per stock replaces materializing/sorting every minute in the window.
create function public.read_stock_window_openings(p_window_minutes integer default 1440,p_as_of timestamptz default null) returns json
language plpgsql stable security invoker set search_path='' as $$
declare anchor timestamptz;
begin
 if p_window_minutes is null or p_window_minutes not in(15,30,60,120,180,360,720,1080,1440,10080,43200) then raise exception 'Unsupported comparison window';end if;
 select provider_at into anchor from public.stock_collection_status where id=1;
 if anchor is null then return json_build_object('provider_at',null,'window_minutes',p_window_minutes,'stocks','[]'::json);end if;
 anchor:=least(anchor,coalesce(p_as_of,anchor));
 return (
  select json_build_object('provider_at',anchor,'window_minutes',p_window_minutes,'stocks',coalesce(json_agg(r order by stock_id),'[]'::json))
  from (
   select stocks.stock_id,p.price open,p.observed_at open_at
   from generate_series(1,35) stocks(stock_id)
   cross join lateral (
    select price,observed_at from public.stock_minute_prices m where m.stock_id=stocks.stock_id
     and m.observed_at>anchor-make_interval(mins=>p_window_minutes) and m.observed_at<=anchor
    order by m.observed_at limit 1
   ) p
  ) r
 );
end $$;
revoke all on function public.read_stock_window_openings(integer,timestamptz) from public,anon;
grant execute on function public.read_stock_window_openings(integer,timestamptz) to authenticated,service_role;
notify pgrst,'reload schema';
