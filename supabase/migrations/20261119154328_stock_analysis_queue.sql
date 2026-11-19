-- Process oldest unfinished stocks first, including after delayed cron ticks.
create or replace function private.enqueue_stock_analyses() returns void language plpgsql security definer set search_path='' as $$
declare stock integer; request bigint; token text;
begin
 select decrypted_secret into token from vault.decrypted_secrets where name='tcc_job_token';
 if token is null then raise exception 'Scheduled stock analysis token is unavailable';end if;
 for stock in
  select n from generate_series(1,35)n left join private.stock_analysis_jobs j on j.stock_id=n
  where (j.lease_until is null or j.lease_until<now()) and
   (select count(*) from public.stock_analysis_results r where r.stock_id=n and r.provider_at=(select provider_at from public.stock_collection_status where id=1))<4
  order by j.provider_at asc nulls first,j.finished_at asc nulls first,n limit 3
 loop
  select net.http_post(url:='https://caxhhhtrlqfuatraamto.supabase.co/functions/v1/analyze-stock-prices',
   headers:=jsonb_build_object('Content-Type','application/json','x-job-token',token),
   body:=jsonb_build_object('stock_id',stock),timeout_milliseconds:=40000) into request;
  insert into private.stock_analysis_jobs(stock_id,request_id) values(stock,request)
  on conflict(stock_id) do update set request_id=excluded.request_id;
 end loop;
end $$;
