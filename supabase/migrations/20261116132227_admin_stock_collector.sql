alter table public.stock_minute_prices drop constraint stock_minute_prices_source_check;
alter table public.stock_minute_prices add constraint stock_minute_prices_source_check check(source in ('Tornsy','Torn API'));
alter table public.stock_collection_status add column quote_source text not null default 'Tornsy' check(quote_source in ('Tornsy','Torn API'));
create table private.stock_collector_owner(id integer primary key check(id=1),user_id uuid references auth.users(id) on delete set null,enabled boolean not null default false);
insert into private.stock_collector_owner(id) values(1);
alter table private.stock_collector_owner enable row level security;
revoke all on private.stock_collector_owner from public,anon,authenticated;
grant all on private.stock_collector_owner to service_role;
create policy collector_owner_service on private.stock_collector_owner to service_role using(true) with check(true);
create function public.configure_stock_collector(p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'Administrator required'; end if;
 if p_enabled is null then raise exception 'Choose enable or disable'; end if;
 if p_enabled and not exists(select 1 from public.linked_torn_accounts a join public.encrypted_credentials c on c.user_id=a.user_id and c.provider='torn' join public.profiles p on p.id=a.user_id where a.user_id=auth.uid() and a.revoked_at is null and a.key_access_level='Full Access' and not p.tracking_paused) then raise exception 'Link and save an active Full Access Torn key in Settings and resume tracking first'; end if;
 if not p_enabled and exists(select 1 from private.stock_collector_owner where id=1 and enabled and user_id is distinct from auth.uid()) then raise exception 'Only the current key owner can disable their collector key'; end if;
 update private.stock_collector_owner set user_id=case when p_enabled then auth.uid() else user_id end,enabled=p_enabled where id=1;
end $$;
create function public.my_stock_collector() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c private.stock_collector_owner;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'Administrator required'; end if;
 select * into c from private.stock_collector_owner where id=1;
 return jsonb_build_object('enabled',c.enabled,'is_owner',c.user_id=auth.uid());
end $$;
create function public.get_stock_collector_owner() returns uuid language sql stable security definer set search_path='' as $$
 select c.user_id from private.stock_collector_owner c join public.profiles p on p.id=c.user_id and p.role='admin' and not p.tracking_paused join public.linked_torn_accounts a on a.user_id=c.user_id and a.revoked_at is null join public.encrypted_credentials e on e.user_id=c.user_id and e.provider='torn' where c.id=1 and c.enabled;
$$;
create function public.disable_stock_collector_key(p_owner uuid) returns void language sql security definer set search_path='' as $$
 update private.stock_collector_owner set enabled=false where id=1 and user_id=p_owner;
$$;
revoke all on function public.configure_stock_collector(boolean),public.my_stock_collector(),public.get_stock_collector_owner(),public.disable_stock_collector_key(uuid) from public,anon,authenticated;
grant execute on function public.configure_stock_collector(boolean),public.my_stock_collector() to authenticated;
grant execute on function public.get_stock_collector_owner(),public.disable_stock_collector_key(uuid) to service_role;
create or replace function public.finish_stock_collection(p_lease uuid,p_provider_at timestamptz,p_points jsonb,p_backfilled boolean default false,p_error text default null) returns integer language plpgsql security definer set search_path='' as $$
declare c private.stock_collection_control; inserted integer; point jsonb; ts timestamptz;
begin
 select * into c from private.stock_collection_control where id=1 for update;
 if p_lease is null or c.lease is null or c.lease is distinct from p_lease or c.lease_until<now() then raise exception 'Collection lease expired'; end if;
 if p_error is not null then
  update public.stock_collection_status set message='Provider refresh failed; previous observations retained',rows_written=0 where id=1;
  update private.stock_collection_control set lease=null,lease_until=null where id=1;
  return 0;
 end if;
 if p_provider_at is null or p_provider_at<now()-interval '3 minutes' or p_provider_at>now()+interval '30 seconds' or mod(extract(epoch from p_provider_at)::numeric,60)<>0 then raise exception 'Provider timestamp is stale or invalid'; end if;
 if jsonb_typeof(p_points) is distinct from 'array' or jsonb_array_length(p_points) not between 35 and 10115 then raise exception 'Incomplete stock batch'; end if;
 if (select count(distinct (e->>'stock_id')::integer) from jsonb_array_elements(p_points)e where (e->>'timestamp')::bigint=extract(epoch from p_provider_at)::bigint)<>35 then raise exception 'All 35 stocks required'; end if;
 for point in select * from jsonb_array_elements(p_points) loop
  ts:=to_timestamp((point->>'timestamp')::bigint);
  if ts<now()-interval '30 days' or ts>p_provider_at or mod(extract(epoch from ts)::numeric,60)<>0 or jsonb_typeof(point->'price') is distinct from 'number' or jsonb_typeof(point->'stock_id') is distinct from 'number' then raise exception 'Invalid minute observation'; end if;
 end loop;
 insert into public.stock_minute_prices(stock_id,observed_at,price,total_shares,source)
 select (e->>'stock_id')::smallint,to_timestamp((e->>'timestamp')::bigint),(e->>'price')::numeric,(e->>'total_shares')::bigint,coalesce(e->>'source','Tornsy') from jsonb_array_elements(p_points)e
 on conflict(stock_id,observed_at) do nothing;
 get diagnostics inserted=row_count;
 update public.stock_collection_status set quote_source=coalesce((p_points->0)->>'source','Tornsy'),last_success=now(),provider_at=p_provider_at,rows_written=inserted,message=case when c.backfill_id<35 then 'Collecting all stocks; warming up seven-day history' else 'Minute collection active' end,backfilled_stocks=least(35,c.backfill_id-1+case when p_backfilled then 1 else 0 end) where id=1;
 update private.stock_collection_control set lease=null,lease_until=null,backfill_id=least(36,backfill_id+case when p_backfilled then 1 else 0 end) where id=1;
 return inserted;
end $$;

notify pgrst,'reload schema';
