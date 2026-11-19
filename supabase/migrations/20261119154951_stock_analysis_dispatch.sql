-- Reserve queued work before HTTP dispatch to avoid duplicate pending jobs.
alter table private.stock_analysis_jobs add column queued_until timestamptz;
create or replace function private.enqueue_stock_analyses() returns void language plpgsql security definer set search_path='' as $$
declare stock integer; request bigint; token text;
begin
 select decrypted_secret into token from vault.decrypted_secrets where name='tcc_job_token';
 if token is null then raise exception 'Scheduled stock analysis token is unavailable';end if;
 for stock in
  select n from generate_series(1,35)n left join private.stock_analysis_jobs j on j.stock_id=n
  where (j.lease_until is null or j.lease_until<now()) and (j.queued_until is null or j.queued_until<now()) and
   (select count(*) from public.stock_analysis_results r where r.stock_id=n and r.provider_at=(select provider_at from public.stock_collection_status where id=1))<4
  order by j.provider_at asc nulls first,j.finished_at asc nulls first,n limit 4
 loop
  select net.http_post(url:='https://caxhhhtrlqfuatraamto.supabase.co/functions/v1/analyze-stock-prices',
   headers:=jsonb_build_object('Content-Type','application/json','x-job-token',token),
   body:=jsonb_build_object('stock_id',stock),timeout_milliseconds:=40000) into request;
  insert into private.stock_analysis_jobs(stock_id,request_id,queued_until) values(stock,request,now()+interval '50 seconds')
  on conflict(stock_id) do update set request_id=excluded.request_id,queued_until=excluded.queued_until;
 end loop;
end $$;
create or replace function private.finish_stock_analysis(p_stock_id integer,p_lease uuid,p_results jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare job private.stock_analysis_jobs; item jsonb;
begin
 select * into job from private.stock_analysis_jobs where stock_id=p_stock_id for update;
 if not found or p_lease is null or job.lease is distinct from p_lease or job.lease_until<now() then return false;end if;
 if p_results is not null then
  if jsonb_typeof(p_results)<>'array' or jsonb_array_length(p_results)<>4 or (select count(distinct (e->>'horizon')::integer) from jsonb_array_elements(p_results)e where (e->>'horizon')::integer in (1,5,15,60))<>4 then raise exception 'Four analysis horizons required';end if;
  for item in select * from jsonb_array_elements(p_results) loop
   if jsonb_typeof(item->'forecast') is distinct from 'object' or jsonb_typeof(item->'forecast'->'points') is distinct from 'array' or jsonb_array_length(item->'forecast'->'points')>60 or jsonb_typeof(item->'processing_ms') is distinct from 'number' or (item->>'processing_ms')::double precision<0 then raise exception 'Invalid cached analysis';end if;
  end loop;
  insert into public.stock_analysis_results(stock_id,horizon,provider_at,computed_at,model_version,forecast,history_from,history_to,processing_ms)
  select p_stock_id,(e->>'horizon')::smallint,job.provider_at,now(),job.model_version,e->'forecast',
   to_timestamp((e->>'history_from')::double precision),to_timestamp((e->>'history_to')::double precision),(e->>'processing_ms')::double precision
  from jsonb_array_elements(p_results)e
  on conflict(stock_id,horizon) do update set provider_at=excluded.provider_at,computed_at=excluded.computed_at,model_version=excluded.model_version,forecast=excluded.forecast,history_from=excluded.history_from,history_to=excluded.history_to,processing_ms=excluded.processing_ms
  where stock_analysis_results.provider_at<=excluded.provider_at;
  update public.stock_analysis_status set provider_at=job.provider_at,computed_at=now(),model_version=job.model_version
   where id=1 and (provider_at is null or provider_at<=job.provider_at);
 end if;
 update private.stock_analysis_jobs set lease=null,lease_until=null,queued_until=null,finished_at=now() where stock_id=p_stock_id;
 return p_results is not null;
end $$;
