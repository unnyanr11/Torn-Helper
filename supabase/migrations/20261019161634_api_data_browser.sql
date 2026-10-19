-- Private observations for the complete official Torn data browser.
create table public.torn_data_cache (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
 endpoint_id text not null,
 parameters jsonb not null default '{}'::jsonb check(jsonb_typeof(parameters)='object'),
 payload jsonb not null check(octet_length(payload::text)<=2097152),
 fetched_at timestamptz not null default now(),
 primary key(user_id,request_hash)
);
alter table public.torn_data_cache enable row level security;
create policy owner_read on public.torn_data_cache for select to authenticated using((select auth.uid())=user_id);
create policy owner_delete on public.torn_data_cache for delete to authenticated using((select auth.uid())=user_id);
revoke all on public.torn_data_cache from public,anon,authenticated;
grant select,delete on public.torn_data_cache to authenticated;
grant all on public.torn_data_cache to service_role;
create index torn_data_cache_expiry on public.torn_data_cache(user_id,fetched_at desc);

create table private.torn_data_budgets (
 scope text not null,subject text not null,bucket timestamptz not null,attempts integer not null,
 primary key(scope,subject,bucket)
);
alter table private.torn_data_budgets enable row level security;
create policy service_only on private.torn_data_budgets to service_role using(true) with check(true);
revoke all on private.torn_data_budgets from public,anon,authenticated;
grant all on private.torn_data_budgets to service_role;
create index torn_data_budgets_expiry on private.torn_data_budgets(bucket);
create function private.consume_torn_data_budget(owner_id uuid,cost integer) returns boolean language plpgsql security definer set search_path='' as $$
declare minute timestamptz:=date_trunc('minute',now()); item record; n integer;
begin
 if owner_id is null or cost is null or cost not between 1 and 5 then raise exception 'Invalid budget request'; end if;
 delete from private.torn_data_budgets where bucket<minute-interval '1 hour';
 for item in select * from (values('global','all',600),('user',owner_id::text,60)) as limits(scope,subject,ceiling) loop
 insert into private.torn_data_budgets(scope,subject,bucket,attempts) values(item.scope,item.subject,minute,cost)
 on conflict(scope,subject,bucket) do update set attempts=private.torn_data_budgets.attempts+cost returning attempts into n;
 if n>item.ceiling then return false; end if;
 end loop;
 return true;
end $$;
create function public.consume_torn_data_budget(owner_id uuid,cost integer) returns boolean language sql security invoker set search_path='' as $$select private.consume_torn_data_budget(owner_id,cost)$$;

create function private.store_torn_data(owner_id uuid,hash text,endpoint text,params jsonb,observation jsonb) returns timestamptz language plpgsql security definer set search_path='' as $$
declare observed timestamptz:=clock_timestamp();
begin
 perform pg_advisory_xact_lock(920318,hashtext(owner_id::text));
 if endpoint is null or length(endpoint)>200 or jsonb_typeof(params) is distinct from 'object' then raise exception 'Invalid observation'; end if;
 insert into public.torn_data_cache(user_id,request_hash,endpoint_id,parameters,payload,fetched_at) values(owner_id,hash,endpoint,params,observation,observed)
 on conflict(user_id,request_hash) do update set payload=excluded.payload,fetched_at=excluded.fetched_at;
 delete from public.torn_data_cache where user_id=owner_id and (fetched_at<now()-interval '24 hours' or request_hash in (select request_hash from public.torn_data_cache where user_id=owner_id order by fetched_at desc,request_hash offset 100));
 return observed;
end $$;
create function public.store_torn_data(owner_id uuid,hash text,endpoint text,params jsonb,observation jsonb) returns timestamptz language sql security invoker set search_path='' as $$select private.store_torn_data(owner_id,hash,endpoint,params,observation)$$;
revoke all on function private.consume_torn_data_budget(uuid,integer),public.consume_torn_data_budget(uuid,integer),private.store_torn_data(uuid,text,text,jsonb,jsonb),public.store_torn_data(uuid,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function private.consume_torn_data_budget(uuid,integer),public.consume_torn_data_budget(uuid,integer),private.store_torn_data(uuid,text,text,jsonb,jsonb),public.store_torn_data(uuid,text,text,jsonb,jsonb) to service_role;
