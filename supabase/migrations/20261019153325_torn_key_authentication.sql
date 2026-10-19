-- Passwordless app authentication is issued only after server-side Torn ownership verification.
create table private.torn_login_limits (
 scope text not null, fingerprint text not null, bucket timestamptz not null,
 attempts integer not null check(attempts>0), primary key(scope,fingerprint,bucket)
);
create index torn_login_limits_expiry on private.torn_login_limits(bucket);
alter table private.torn_login_limits enable row level security;
create policy service_only on private.torn_login_limits to service_role using(true) with check(true);
revoke all on private.torn_login_limits from public,anon,authenticated;
grant all on private.torn_login_limits to service_role;
create function private.consume_torn_login_budget(ip_fingerprint text,key_fingerprint text) returns boolean language plpgsql security definer set search_path='' as $$
declare minute timestamptz:=date_trunc('minute',now()); n integer; item record;
begin
 if ip_fingerprint is null or key_fingerprint is null or ip_fingerprint !~ '^[a-f0-9]{64}$' or key_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'Invalid request fingerprint'; end if;
 delete from private.torn_login_limits where bucket<minute-interval '1 hour';
 for item in select * from (values('global','all',200),('ip',ip_fingerprint,30),('key',key_fingerprint,5)) as limits(scope,fingerprint,ceiling) loop
 insert into private.torn_login_limits(scope,fingerprint,bucket,attempts) values(item.scope,item.fingerprint,minute,1)
 on conflict(scope,fingerprint,bucket) do update set attempts=private.torn_login_limits.attempts+1 returning attempts into n;
 if n>item.ceiling then return false; end if;
 end loop;
 return true;
end $$;
create function private.complete_torn_login(player_id bigint,proposed_user uuid,player_name text,access_level text,persist_key boolean,ciphertext text) returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 if player_id is null or player_id<1 or player_id>9007199254740991 or proposed_user is null or player_name is null or length(player_name) not between 1 and 100 or access_level is null or access_level not in ('Public Only','Minimal Access','Limited Access','Full Access','Custom') or persist_key is null then raise exception 'Invalid verified identity'; end if;
 if persist_key and (ciphertext is null or length(ciphertext) not between 24 and 4096 or ciphertext not like '%:%') then raise exception 'Encrypted key required'; end if;
 perform pg_advisory_xact_lock(920317,hashtext(player_id::text));
 select user_id into owner_id from public.linked_torn_accounts where torn_id=player_id for update;
 if not found then
 insert into public.linked_torn_accounts(user_id,torn_id,torn_name,key_access_level) values(proposed_user,player_id,player_name,access_level) returning user_id into owner_id;
 else
 update public.linked_torn_accounts set torn_name=player_name,key_access_level=access_level,revoked_at=null where torn_id=player_id;
 end if;
 if persist_key then
 insert into public.encrypted_credentials(user_id,provider,encrypted_key) values(owner_id,'torn',ciphertext) on conflict(user_id,provider) do update set encrypted_key=excluded.encrypted_key;
 else
 delete from public.encrypted_credentials where user_id=owner_id and provider='torn';
 end if;
 return owner_id;
end $$;
create function public.consume_torn_login_budget(ip_fingerprint text,key_fingerprint text) returns boolean language sql security invoker set search_path='' as $$select private.consume_torn_login_budget(ip_fingerprint,key_fingerprint)$$;
create function public.complete_torn_login(player_id bigint,proposed_user uuid,player_name text,access_level text,persist_key boolean,ciphertext text) returns uuid language sql security invoker set search_path='' as $$select private.complete_torn_login(player_id,proposed_user,player_name,access_level,persist_key,ciphertext)$$;
revoke all on function private.consume_torn_login_budget(text,text),public.consume_torn_login_budget(text,text),private.complete_torn_login(bigint,uuid,text,text,boolean,text),public.complete_torn_login(bigint,uuid,text,text,boolean,text) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.consume_torn_login_budget(text,text),public.consume_torn_login_budget(text,text),private.complete_torn_login(bigint,uuid,text,text,boolean,text),public.complete_torn_login(bigint,uuid,text,text,boolean,text) to service_role;
