-- Preserve minute fitting for any legacy trainer during a staged rollout.
create or replace function private.claim_stock_analysis(p_stock_id integer,p_model_version text) returns jsonb language plpgsql security definer set search_path='' as $$
declare observed timestamptz; token uuid:=gen_random_uuid(); claimed uuid;
begin
 if p_stock_id is null or p_stock_id not between 1 and 35 or p_model_version is null or length(p_model_version) not between 1 and 100 then raise exception 'Invalid stock analysis request';end if;
 select provider_at into observed from public.stock_collection_status where id=1;
 if observed is null or observed<now()-interval '3 minutes' then return null;end if;
 if p_model_version='server-minute-v5-cached-inference' then
 if (select count(*) from private.stock_fitted_models where stock_id=p_stock_id and model_version=p_model_version and trained_at>now()-interval '15 minutes' and (not(forecast?'issue') or trained_at>now()-interval '1 minute'))=4 then return null;end if;
 else
  if(select count(*) from public.stock_analysis_results where stock_id=p_stock_id and provider_at=observed and model_version=p_model_version)=4 then return null;end if;
 end if;
 insert into private.stock_analysis_jobs(stock_id,lease,lease_until,provider_at,model_version)
 values(p_stock_id,token,now()+interval '45 seconds',observed,p_model_version)
 on conflict(stock_id) do update set lease=excluded.lease,lease_until=excluded.lease_until,provider_at=excluded.provider_at,model_version=excluded.model_version
 where stock_analysis_jobs.lease_until is null or stock_analysis_jobs.lease_until<now()
 returning lease into claimed;
 if claimed is null then return null;end if;
 return jsonb_build_object('lease',claimed,'provider_at',observed);
end $$;

notify pgrst,'reload schema';
