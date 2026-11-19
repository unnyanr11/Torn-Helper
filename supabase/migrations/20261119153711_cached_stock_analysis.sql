create table if not exists public.stock_analysis_results (
 stock_id smallint not null check(stock_id between 1 and 35),
 horizon smallint not null check(horizon in (1,5,15,60)),
 provider_at timestamptz not null,computed_at timestamptz not null default now(),
 model_version text not null,
 forecast jsonb not null check(jsonb_typeof(forecast)='object'),
 history_from timestamptz,history_to timestamptz,
 processing_ms double precision not null check(processing_ms>=0),
 primary key(stock_id,horizon)
);
alter table public.stock_analysis_results enable row level security;
revoke all on public.stock_analysis_results from public,anon,authenticated;
grant select on public.stock_analysis_results to authenticated;
grant all on public.stock_analysis_results to service_role;
drop policy if exists stock_analysis_read on public.stock_analysis_results;
create policy stock_analysis_read on public.stock_analysis_results for select to authenticated using(true);

create table if not exists public.stock_analysis_status (
 id integer primary key check(id=1),provider_at timestamptz,computed_at timestamptz,model_version text
);
insert into public.stock_analysis_status(id) values(1) on conflict do nothing;
alter table public.stock_analysis_status enable row level security;
revoke all on public.stock_analysis_status from public,anon,authenticated;
grant select on public.stock_analysis_status to authenticated;
grant all on public.stock_analysis_status to service_role;
drop policy if exists stock_analysis_status_read on public.stock_analysis_status;
create policy stock_analysis_status_read on public.stock_analysis_status for select to authenticated using(true);
do $$begin if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='stock_analysis_status') then alter publication supabase_realtime add table public.stock_analysis_status;end if;end $$;

create table if not exists private.stock_analysis_jobs (
 stock_id smallint primary key check(stock_id between 1 and 35),
 lease uuid,lease_until timestamptz,provider_at timestamptz,
 model_version text,request_id bigint,finished_at timestamptz
);
alter table private.stock_analysis_jobs enable row level security;
revoke all on private.stock_analysis_jobs from public,anon,authenticated;
grant all on private.stock_analysis_jobs to service_role;
drop policy if exists stock_analysis_jobs_service on private.stock_analysis_jobs;
create policy stock_analysis_jobs_service on private.stock_analysis_jobs to service_role using(true) with check(true);

create or replace function private.claim_stock_analysis(p_stock_id integer,p_model_version text) returns jsonb language plpgsql security definer set search_path='' as $$
declare observed timestamptz; token uuid:=gen_random_uuid(); claimed uuid;
begin
 if p_stock_id is null or p_stock_id not between 1 and 35 or p_model_version is null or length(p_model_version) not between 1 and 100 then raise exception 'Invalid stock analysis request';end if;
 select provider_at into observed from public.stock_collection_status where id=1;
 if observed is null or observed<now()-interval '3 minutes' then return null;end if;
 if (select count(*) from public.stock_analysis_results where stock_id=p_stock_id and provider_at=observed and model_version=p_model_version)=4 then return null;end if;
 insert into private.stock_analysis_jobs(stock_id,lease,lease_until,provider_at,model_version)
 values(p_stock_id,token,now()+interval '45 seconds',observed,p_model_version)
 on conflict(stock_id) do update set lease=excluded.lease,lease_until=excluded.lease_until,provider_at=excluded.provider_at,model_version=excluded.model_version
 where stock_analysis_jobs.lease_until is null or stock_analysis_jobs.lease_until<now()
 returning lease into claimed;
 if claimed is null then return null;end if;
 return jsonb_build_object('lease',claimed,'provider_at',observed);
end $$;
create or replace function public.claim_stock_analysis(p_stock_id integer,p_model_version text) returns jsonb language sql security invoker set search_path='' as $$select private.claim_stock_analysis(p_stock_id,p_model_version)$$;

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
  if (select count(*) from public.stock_analysis_results where provider_at=job.provider_at and model_version=job.model_version)=140 then
   update public.stock_analysis_status set provider_at=job.provider_at,computed_at=now(),model_version=job.model_version
   where id=1 and (provider_at is null or provider_at<=job.provider_at);
  end if;
 end if;
 update private.stock_analysis_jobs set lease=null,lease_until=null,finished_at=now() where stock_id=p_stock_id;
 return p_results is not null;
end $$;
create or replace function public.finish_stock_analysis(p_stock_id integer,p_lease uuid,p_results jsonb) returns boolean language sql security invoker set search_path='' as $$select private.finish_stock_analysis(p_stock_id,p_lease,p_results)$$;
revoke all on function private.claim_stock_analysis(integer,text),public.claim_stock_analysis(integer,text),private.finish_stock_analysis(integer,uuid,jsonb),public.finish_stock_analysis(integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.claim_stock_analysis(integer,text),public.claim_stock_analysis(integer,text),private.finish_stock_analysis(integer,uuid,jsonb),public.finish_stock_analysis(integer,uuid,jsonb) to service_role;

create or replace function private.enqueue_stock_analyses() returns void language plpgsql security definer set search_path='' as $$
declare stock integer; request bigint; token text;
begin
 select decrypted_secret into token from vault.decrypted_secrets where name='tcc_job_token';
 if token is null then raise exception 'Scheduled stock analysis token is unavailable';end if;
 for stock in 1..35 loop
  select net.http_post(url:='https://caxhhhtrlqfuatraamto.supabase.co/functions/v1/analyze-stock-prices',
   headers:=jsonb_build_object('Content-Type','application/json','x-job-token',token),
   body:=jsonb_build_object('stock_id',stock),timeout_milliseconds:=40000) into request;
  insert into private.stock_analysis_jobs(stock_id,request_id) values(stock,request)
  on conflict(stock_id) do update set request_id=excluded.request_id;
 end loop;
end $$;
revoke all on function private.enqueue_stock_analyses() from public,anon,authenticated;
grant execute on function private.enqueue_stock_analyses() to service_role;
create or replace function private.on_stock_batch_analyse() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform private.enqueue_stock_analyses();return new;
end $$;
revoke all on function private.on_stock_batch_analyse() from public,anon,authenticated;
drop trigger if exists stock_batch_analysis on public.stock_collection_status;
create trigger stock_batch_analysis after update on public.stock_collection_status
 for each row when(new.provider_at is not null and (new.provider_at is distinct from old.provider_at or new.backfilled_stocks is distinct from old.backfilled_stocks))
 execute function private.on_stock_batch_analyse();
notify pgrst,'reload schema';
