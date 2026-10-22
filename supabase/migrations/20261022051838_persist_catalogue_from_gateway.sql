-- Existing torn-data validates the linked key and is the only writer of this cache.
-- Copy only public item metadata, never the key, prices or personal inventory.
create function private.persist_item_catalogue_from_gateway() returns trigger
language plpgsql security invoker set search_path='' as $$
declare token uuid; metadata jsonb;
begin
 if new.endpoint_id<>'v2-torn-items' or coalesce(new.parameters->>'cat','All')<>'All' then return new; end if;
 if jsonb_typeof(new.payload->'items') is distinct from 'array' then return new; end if;
 if jsonb_array_length(new.payload->'items')=0 or new.payload#>>'{_metadata,links,next}' is not null then return new; end if;
 if exists(select 1 from jsonb_array_elements(new.payload->'items') i where
  jsonb_typeof(i->'id') is distinct from 'number' or (i->>'id') !~ '^[1-9][0-9]*$' or
  jsonb_typeof(i->'name') is distinct from 'string' or length(btrim(i->>'name'))=0 or
  jsonb_typeof(i->'type') is distinct from 'string' or length(btrim(i->>'type'))=0 or
  (i->'sub_type' is not null and jsonb_typeof(i->'sub_type') not in ('string','null')))
 then return new; end if;
 token:=public.claim_item_catalogue_refresh(new.parameters ? 'timestamp');
 if token is null then return new; end if;
 select jsonb_agg(jsonb_build_object('id',i->'id','name',i->>'name','type',i->>'type','sub_type',i->>'sub_type')) into metadata from jsonb_array_elements(new.payload->'items') i;
 begin
  perform public.save_torn_item_catalogue(token,metadata);
 exception when others then
  -- A failed metadata import must not discard a legitimate live API observation.
  perform public.release_item_catalogue_refresh(token);
 end;
 return new;
end;
$$;
revoke all on function private.persist_item_catalogue_from_gateway() from public,anon,authenticated;
grant execute on function private.persist_item_catalogue_from_gateway() to service_role;
create trigger persist_item_catalogue after insert or update of payload on public.torn_data_cache
 for each row execute function private.persist_item_catalogue_from_gateway();
