-- Fit weekly models in background; apply saved coefficients to all stocks at once.
create table private.stock_fitted_models (
 stock_id smallint not null check(stock_id between 1 and 35),
 horizon smallint not null check(horizon in(1,5,15,60)),
 forecast jsonb not null,model_version text not null,trained_at timestamptz not null,
 history_from timestamptz,history_to timestamptz,primary key(stock_id,horizon)
);
alter table private.stock_fitted_models enable row level security;
revoke all on private.stock_fitted_models from public,anon,authenticated;
grant all on private.stock_fitted_models to service_role;
create policy stock_fitted_service on private.stock_fitted_models to service_role using(true) with check(true);
alter table public.stock_analysis_status add column duration_ms double precision,add column stock_count integer,add column forecast_count integer,add column within_budget boolean;

create function private.enqueue_stock_inference() returns void language plpgsql security definer set search_path='' as $$
declare token text; observed timestamptz;
begin
 select provider_at into observed from public.stock_collection_status where id=1;
 if observed is null or observed<now()-interval '2 minutes' then return;end if;
 if (select count(*) from private.stock_fitted_models where model_version='server-minute-v5-cached-inference')<>140 then return;end if;
 if exists(select 1 from public.stock_analysis_status where id=1 and provider_at>=observed and model_version='server-minute-v5-cached-inference' and forecast_count=140) then return;end if;
 select decrypted_secret into token from vault.decrypted_secrets where name='tcc_job_token';
 if token is null then return;end if;
 perform net.http_post(url:='https://caxhhhtrlqfuatraamto.supabase.co/functions/v1/infer-stock-prices',headers:=jsonb_build_object('Content-Type','application/json','x-job-token',token),body:='{}'::jsonb,timeout_milliseconds:=20000);
end $$;
revoke all on function private.enqueue_stock_inference() from public,anon,authenticated;
grant execute on function private.enqueue_stock_inference() to service_role;
create function private.on_stock_inference_batch() returns trigger language plpgsql security definer set search_path='' as $$begin perform private.enqueue_stock_inference();return new;end $$;
revoke all on function private.on_stock_inference_batch() from public,anon,authenticated;
create trigger stock_inference_batch after update on public.stock_collection_status for each row when(new.provider_at is not null and new.provider_at is distinct from old.provider_at) execute function private.on_stock_inference_batch();

create function private.read_stock_inference_input() returns json language sql stable security definer set search_path='' as $$
 select json_build_object('provider_at',s.provider_at,
 'models',(select coalesce(json_agg(m order by stock_id,horizon),'[]'::json) from private.stock_fitted_models m),
 'prices',(select coalesce(json_object_agg(stock_id,points),'{}'::json) from(
  select stock_id,json_agg(json_build_array(extract(epoch from observed_at)::bigint,price) order by observed_at) points
  from public.stock_minute_prices where observed_at>s.provider_at-interval '3 hours' and observed_at<=s.provider_at group by stock_id)p))
 from public.stock_collection_status s where id=1;
$$;
create function public.read_stock_inference_input() returns json language sql security invoker set search_path='' as $$select private.read_stock_inference_input()$$;
revoke all on function private.read_stock_inference_input(),public.read_stock_inference_input() from public,anon,authenticated;
grant execute on function private.read_stock_inference_input(),public.read_stock_inference_input() to service_role;

create function private.publish_stock_inference(p_provider_at timestamptz,p_model_version text,p_started_at timestamptz,p_results jsonb) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_provider_at is null or p_provider_at<now()-interval '2 minutes' or p_provider_at is distinct from(select provider_at from public.stock_collection_status where id=1) then return false;end if;
 if p_model_version is distinct from 'server-minute-v5-cached-inference' or p_started_at is null or p_started_at>now()+interval '30 seconds' then raise exception 'Invalid inference generation';end if;
 if jsonb_typeof(p_results) is distinct from 'array' or jsonb_array_length(p_results)<>140 then raise exception 'All 140 forecasts are required';end if;
 if(select count(distinct ((e->>'stock_id')::integer,(e->>'horizon')::integer)) from jsonb_array_elements(p_results)e where (e->>'stock_id')::integer between 1 and 35 and (e->>'horizon')::integer in(1,5,15,60) and jsonb_typeof(e->'forecast')='object' and (e->'forecast'->'last'->>'timestamp')::bigint=extract(epoch from p_provider_at)::bigint and jsonb_array_length(e->'forecast'->'points')<=60 and (e->>'processing_ms')::double precision>=0)<>140 then raise exception 'Invalid stock forecasts';end if;
 insert into public.stock_analysis_results(stock_id,horizon,provider_at,computed_at,model_version,forecast,history_from,history_to,processing_ms)
 select (e->>'stock_id')::smallint,(e->>'horizon')::smallint,p_provider_at,clock_timestamp(),p_model_version,e->'forecast',(e->>'history_from')::timestamptz,(e->>'history_to')::timestamptz,(e->>'processing_ms')::double precision from jsonb_array_elements(p_results)e
 on conflict(stock_id,horizon) do update set provider_at=excluded.provider_at,computed_at=excluded.computed_at,model_version=excluded.model_version,forecast=excluded.forecast,history_from=excluded.history_from,history_to=excluded.history_to,processing_ms=excluded.processing_ms where stock_analysis_results.provider_at<=excluded.provider_at;
 update public.stock_analysis_status set provider_at=p_provider_at,computed_at=clock_timestamp(),model_version=p_model_version,stock_count=35,forecast_count=140,duration_ms=extract(epoch from clock_timestamp()-p_started_at)*1000,within_budget=(clock_timestamp()-p_started_at<interval '10 seconds') where id=1 and (provider_at is null or provider_at<=p_provider_at);
 return true;
end $$;
create function public.publish_stock_inference(p_provider_at timestamptz,p_model_version text,p_started_at timestamptz,p_results jsonb) returns boolean language sql security invoker set search_path='' as $$select private.publish_stock_inference(p_provider_at,p_model_version,p_started_at,p_results)$$;
revoke all on function private.publish_stock_inference(timestamptz,text,timestamptz,jsonb),public.publish_stock_inference(timestamptz,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function private.publish_stock_inference(timestamptz,text,timestamptz,jsonb),public.publish_stock_inference(timestamptz,text,timestamptz,jsonb) to service_role;

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
  insert into private.stock_fitted_models(stock_id,horizon,forecast,model_version,trained_at,history_from,history_to)
  select p_stock_id,(e->>'horizon')::smallint,(e->'forecast')-'points'-'validation',job.model_version,clock_timestamp(),to_timestamp((e->>'history_from')::double precision),to_timestamp((e->>'history_to')::double precision) from jsonb_array_elements(p_results)e
  on conflict(stock_id,horizon) do update set forecast=excluded.forecast,model_version=excluded.model_version,trained_at=excluded.trained_at,history_from=excluded.history_from,history_to=excluded.history_to;
  perform private.enqueue_stock_inference();
 end if;
 update private.stock_analysis_jobs set lease=null,lease_until=null,queued_until=null,finished_at=now() where stock_id=p_stock_id;
 return p_results is not null;
end $$;

create or replace function private.enqueue_stock_analyses() returns void language plpgsql security definer set search_path='' as $$
declare stock integer; request bigint; token text;
begin
 select decrypted_secret into token from vault.decrypted_secrets where name='tcc_job_token';
 if token is null then raise exception 'Scheduled stock analysis token is unavailable';end if;
 for stock in
  select n from generate_series(1,35)n left join private.stock_analysis_jobs j on j.stock_id=n
  where (j.lease_until is null or j.lease_until<now()) and (j.queued_until is null or j.queued_until<now()) and
   (select count(*) from private.stock_fitted_models m where m.stock_id=n and m.model_version='server-minute-v5-cached-inference' and m.trained_at>now()-interval '15 minutes' and (not(m.forecast?'issue') or m.trained_at>now()-interval '1 minute'))<4
  order by j.provider_at asc nulls first,j.finished_at asc nulls first,n limit 7
 loop
  select net.http_post(url:='https://caxhhhtrlqfuatraamto.supabase.co/functions/v1/analyze-stock-prices',
   headers:=jsonb_build_object('Content-Type','application/json','x-job-token',token),
   body:=jsonb_build_object('stock_id',stock),timeout_milliseconds:=40000) into request;
  insert into private.stock_analysis_jobs(stock_id,request_id,queued_until) values(stock,request,now()+interval '50 seconds')
  on conflict(stock_id) do update set request_id=excluded.request_id,queued_until=excluded.queued_until;
 end loop;
end $$;


create or replace function private.claim_stock_analysis(p_stock_id integer,p_model_version text) returns jsonb language plpgsql security definer set search_path='' as $$
declare observed timestamptz; token uuid:=gen_random_uuid(); claimed uuid;
begin
 if p_stock_id is null or p_stock_id not between 1 and 35 or p_model_version is null or length(p_model_version) not between 1 and 100 then raise exception 'Invalid stock analysis request';end if;
 select provider_at into observed from public.stock_collection_status where id=1;
 if observed is null or observed<now()-interval '3 minutes' then return null;end if;
 if (select count(*) from private.stock_fitted_models where stock_id=p_stock_id and model_version=p_model_version and trained_at>now()-interval '15 minutes' and (not(forecast?'issue') or trained_at>now()-interval '1 minute'))=4 then return null;end if;
 insert into private.stock_analysis_jobs(stock_id,lease,lease_until,provider_at,model_version)
 values(p_stock_id,token,now()+interval '45 seconds',observed,p_model_version)
 on conflict(stock_id) do update set lease=excluded.lease,lease_until=excluded.lease_until,provider_at=excluded.provider_at,model_version=excluded.model_version
 where stock_analysis_jobs.lease_until is null or stock_analysis_jobs.lease_until<now()
 returning lease into claimed;
 if claimed is null then return null;end if;
 return jsonb_build_object('lease',claimed,'provider_at',observed);
end $$;

notify pgrst,'reload schema';
