-- Dedicated provider credentials stay in Vault. Public stock requests share a cache and quota.
create table if not exists private.shared_stock_provider (
 id integer primary key check(id=1),
 secret_id uuid not null,
 torn_id bigint not null check(torn_id>0),
 enabled boolean not null default true
);
alter table private.shared_stock_provider enable row level security;
revoke all on private.shared_stock_provider from public,anon,authenticated;
grant all on private.shared_stock_provider to service_role;
drop policy if exists shared_stock_service on private.shared_stock_provider;
create policy shared_stock_service on private.shared_stock_provider to service_role using(true) with check(true);

create or replace function private.get_shared_stock_provider() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('api_key',s.decrypted_secret,'budget_owner',
  coalesce((select a.user_id from public.linked_torn_accounts a where a.torn_id=p.torn_id),
    md5('torn-stock-provider:'||p.torn_id::text)::uuid))
 from private.shared_stock_provider p join vault.decrypted_secrets s on s.id=p.secret_id
 where p.id=1 and p.enabled;
$$;
create or replace function public.get_shared_stock_provider() returns jsonb
language sql stable security invoker set search_path='' as $$select private.get_shared_stock_provider()$$;
revoke all on function private.get_shared_stock_provider(),public.get_shared_stock_provider() from public,anon,authenticated;
grant execute on function private.get_shared_stock_provider(),public.get_shared_stock_provider() to service_role;

create table if not exists public.stock_public_cache (
 path text primary key check(length(path)<=2048),
 payload jsonb,
 fetched_at timestamptz,
 refresh_until timestamptz,
 refresh_token uuid
);
alter table public.stock_public_cache enable row level security;
revoke all on public.stock_public_cache from public,anon,authenticated;
grant all on public.stock_public_cache to service_role;
drop policy if exists stock_cache_service on public.stock_public_cache;
create policy stock_cache_service on public.stock_public_cache to service_role using(true) with check(true);

create or replace function private.claim_stock_public_refresh(p_path text) returns uuid
language plpgsql security definer set search_path='' as $$
declare token uuid:=gen_random_uuid(); claimed uuid;
begin
 if p_path is null or length(p_path)>2048 or p_path !~ '^/torn(/(stocks|([1-9]|[12][0-9]|3[0-5])/stocks)([?].*)?|[?].*selections=stocks([&].*)?)$' then raise exception 'Unsupported stock path';end if;
 insert into public.stock_public_cache(path,refresh_until,refresh_token)
 values(p_path,now()+interval '30 seconds',token)
 on conflict(path) do update set refresh_until=excluded.refresh_until,refresh_token=excluded.refresh_token
 where stock_public_cache.refresh_until is null or stock_public_cache.refresh_until<now()
 returning refresh_token into claimed;
 return claimed;
end $$;
create or replace function public.claim_stock_public_refresh(p_path text) returns uuid
language sql security invoker set search_path='' as $$select private.claim_stock_public_refresh(p_path)$$;
revoke all on function private.claim_stock_public_refresh(text),public.claim_stock_public_refresh(text) from public,anon,authenticated;
grant execute on function private.claim_stock_public_refresh(text),public.claim_stock_public_refresh(text) to service_role;

create or replace function public.my_stock_collector() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c private.stock_collector_owner;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'Administrator required'; end if;
 if exists(select 1 from private.shared_stock_provider where id=1 and enabled) then
  return jsonb_build_object('enabled',true,'is_owner',false,'shared',true);
 end if;
 select * into c from private.stock_collector_owner where id=1;
 return jsonb_build_object('enabled',c.enabled,'is_owner',c.user_id=auth.uid(),'shared',false);
end $$;
notify pgrst,'reload schema';
