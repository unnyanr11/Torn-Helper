-- Public game reference data; no prices, keys, inventory or account data.
create table public.torn_item_catalogue (
 id integer primary key check(id>0),
 name text not null check(length(btrim(name)) between 1 and 300),
 category text not null check(length(btrim(category)) between 1 and 100),
 item_type text check(item_type is null or length(btrim(item_type)) between 1 and 100),
 last_seen_at timestamptz not null
);
create table public.torn_item_catalogue_state (
 singleton boolean primary key default true check(singleton),
 item_count integer not null default 0 check(item_count>=0),
 fetched_at timestamptz,
 refresh_token uuid,
 lease_until timestamptz
);
insert into public.torn_item_catalogue_state(singleton) values(true);
alter table public.torn_item_catalogue enable row level security;
alter table public.torn_item_catalogue_state enable row level security;
create policy signed_in_reference_read on public.torn_item_catalogue for select to authenticated using(true);
create policy signed_in_reference_read on public.torn_item_catalogue_state for select to authenticated using(true);
revoke all on public.torn_item_catalogue,public.torn_item_catalogue_state from public,anon,authenticated;
grant select on public.torn_item_catalogue to authenticated;
grant select(singleton,item_count,fetched_at) on public.torn_item_catalogue_state to authenticated;
grant all on public.torn_item_catalogue,public.torn_item_catalogue_state to service_role;

-- JSON aggregate avoids the REST 1,000-row default truncating the catalogue.
create function public.get_torn_item_catalogue() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('item_count',s.item_count,'fetched_at',s.fetched_at,'items',
  coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'type',i.category,'sub_type',i.item_type) order by i.id) from public.torn_item_catalogue i),'[]'::jsonb))
 from public.torn_item_catalogue_state s where s.singleton=true;
$$;

-- Only the trusted Edge Function can acquire a lease and publish official data.
create function public.claim_item_catalogue_refresh(manual_refresh boolean default false) returns uuid
language plpgsql security invoker set search_path='' as $$
declare token uuid;
begin
 update public.torn_item_catalogue_state set refresh_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes'
 where singleton=true and (lease_until is null or lease_until<clock_timestamp())
 and (fetched_at is null or (manual_refresh and fetched_at<clock_timestamp()-interval '24 hours'))
 returning refresh_token into token;
 return token;
end;
$$;
create function public.release_item_catalogue_refresh(token uuid) returns void
language sql security invoker set search_path='' as $$
 update public.torn_item_catalogue_state set refresh_token=null,lease_until=null where singleton=true and refresh_token=token;
$$;
create function public.save_torn_item_catalogue(token uuid,items jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare observed timestamptz:=clock_timestamp(); incoming_count integer;
begin
 perform 1 from public.torn_item_catalogue_state where singleton=true and refresh_token=token and lease_until>clock_timestamp() for update;
 if not found then raise exception 'Catalogue refresh lease expired'; end if;
 if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items)=0 then raise exception 'A nonempty item catalogue is required'; end if;
 incoming_count:=jsonb_array_length(items);
 if incoming_count<(select count(*) from public.torn_item_catalogue where last_seen_at=(select fetched_at from public.torn_item_catalogue_state where singleton=true)) then
  raise exception 'Incomplete catalogue: existing records were kept';
 end if;
 -- Constraints reject malformed metadata; the transaction keeps the old snapshot on failure.
 insert into public.torn_item_catalogue(id,name,category,item_type,last_seen_at)
 select r.id,r.name,r.type,r.sub_type,observed from jsonb_to_recordset(items) as r(id integer,name text,type text,sub_type text)
 on conflict(id) do update set name=excluded.name,category=excluded.category,item_type=excluded.item_type,last_seen_at=excluded.last_seen_at;
 update public.torn_item_catalogue_state set item_count=(select count(*) from public.torn_item_catalogue),fetched_at=observed,refresh_token=null,lease_until=null where singleton=true;
 return public.get_torn_item_catalogue();
end;
$$;
revoke all on function public.get_torn_item_catalogue() from public,anon;
grant execute on function public.get_torn_item_catalogue() to authenticated,service_role;
revoke all on function public.claim_item_catalogue_refresh(boolean),public.release_item_catalogue_refresh(uuid),public.save_torn_item_catalogue(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.claim_item_catalogue_refresh(boolean),public.release_item_catalogue_refresh(uuid),public.save_torn_item_catalogue(uuid,jsonb) to service_role;
