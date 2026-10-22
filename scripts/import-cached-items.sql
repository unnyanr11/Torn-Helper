-- Reuse one existing official All-items response; no Torn request or API key needed.
do $$
declare source jsonb; token uuid; metadata jsonb;
begin
 select payload into source from public.torn_data_cache
 where endpoint_id='v2-torn-items' and coalesce(parameters->>'cat','All')='All'
 and jsonb_typeof(payload->'items')='array' and payload#>>'{_metadata,links,next}' is null
 order by jsonb_array_length(payload->'items') desc,fetched_at desc limit 1;
 if source is null then return; end if;
 token:=public.claim_item_catalogue_refresh(false);
 if token is null then return; end if;
 select jsonb_agg(jsonb_build_object('id',i->'id','name',i->>'name','type',i->>'type','sub_type',i->>'sub_type')) into metadata from jsonb_array_elements(source->'items') i;
 perform public.save_torn_item_catalogue(token,metadata);
end;
$$;
select count(*) as saved_items,count(distinct category) as categories,count(distinct item_type) as item_types from public.torn_item_catalogue;
