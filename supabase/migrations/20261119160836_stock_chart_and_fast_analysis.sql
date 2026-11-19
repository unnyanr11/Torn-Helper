-- Compact independent history serves charts and backend training. Plain JSON
-- avoids constructing thousands of keyed binary JSON objects per stock.
create function public.read_stock_chart_history(p_stock_id integer,p_after bigint default null) returns json
language sql stable security invoker set search_path='' as $$
 select json_build_object('provider_at',(select provider_at from public.stock_collection_status where id=1),
  'points',coalesce(json_agg(json_build_array(extract(epoch from observed_at)::bigint,price) order by observed_at),'[]'::json))
 from (select observed_at,price from public.stock_minute_prices
  where stock_id=p_stock_id and p_stock_id between 1 and 35
  and observed_at>greatest(now()-interval '7 days',coalesce(to_timestamp(p_after),now()-interval '7 days'))
  order by observed_at desc limit 10080) p;
$$;
revoke all on function public.read_stock_chart_history(integer,bigint) from public,anon;
grant execute on function public.read_stock_chart_history(integer,bigint) to authenticated,service_role;
-- Fewer cron connections, with bounded jobs and the existing queue reservations.
create or replace function private.enqueue_stock_analyses() returns void language plpgsql security definer set search_path='' as $$
declare stock integer; request bigint; token text;
begin
 select decrypted_secret into token from vault.decrypted_secrets where name='tcc_job_token';
 if token is null then raise exception 'Scheduled stock analysis token is unavailable';end if;
 for stock in
  select n from generate_series(1,35)n left join private.stock_analysis_jobs j on j.stock_id=n
  where (j.lease_until is null or j.lease_until<now()) and (j.queued_until is null or j.queued_until<now()) and
   (select count(*) from public.stock_analysis_results r where r.stock_id=n and r.provider_at=(select provider_at from public.stock_collection_status where id=1))<4
  order by j.provider_at asc nulls first,j.finished_at asc nulls first,n limit 7
 loop
  select net.http_post(url:='https://caxhhhtrlqfuatraamto.supabase.co/functions/v1/analyze-stock-prices',
   headers:=jsonb_build_object('Content-Type','application/json','x-job-token',token),
   body:=jsonb_build_object('stock_id',stock),timeout_milliseconds:=40000) into request;
  insert into private.stock_analysis_jobs(stock_id,request_id,queued_until) values(stock,request,now()+interval '50 seconds')
  on conflict(stock_id) do update set request_id=excluded.request_id,queued_until=excluded.queued_until;
 end loop;
end $$;

select cron.schedule('stock-analysis-batches','10 seconds',$job$select private.enqueue_stock_analyses()$job$);
notify pgrst,'reload schema';
