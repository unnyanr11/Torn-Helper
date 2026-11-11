-- Match Torn's published 100 calls/player/minute and 5,000 calls/IP/minute.
-- One global service budget is conservative even if hosting uses several egress IPs.
-- Authentication abuse limits and concurrent-request leases remain separate controls.
create or replace function private.consume_torn_data_budget(owner_id uuid,cost integer) returns boolean language plpgsql security definer set search_path='' as $$
declare minute timestamptz:=date_trunc('minute',now()); item record; n integer;
begin
 if owner_id is null or cost is null or cost not between 1 and 5 then raise exception 'Invalid budget request';end if;
 perform pg_advisory_xact_lock(920320,2);
 delete from private.torn_data_budgets where bucket<minute-interval '1 day';
 for item in select * from (values('user',owner_id::text,100),('global','all',5000)) as limits(scope,subject,ceiling) loop
  select attempts into n from private.torn_data_budgets b where b.scope=item.scope and b.subject=item.subject and b.bucket=minute;
  if coalesce(n,0)+cost>item.ceiling then return false;end if;
 end loop;
 insert into private.torn_data_budgets(scope,subject,bucket,attempts) values('user',owner_id::text,minute,cost),('global','all',minute,cost)
 on conflict(scope,subject,bucket) do update set attempts=private.torn_data_budgets.attempts+cost;
 return true;
end $$;

create or replace function private.consume_torn_login_budget(ip_fingerprint text,key_fingerprint text) returns boolean language plpgsql security definer set search_path='' as $$
declare minute timestamptz:=date_trunc('minute',now()); item record; n integer;
begin
 if ip_fingerprint is null or key_fingerprint is null or ip_fingerprint !~ '^[a-f0-9]{64}$' or key_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'Invalid request fingerprint';end if;
 perform pg_advisory_xact_lock(920320,1);
 perform pg_advisory_xact_lock(920320,2);
 delete from private.torn_login_limits where bucket<minute-interval '1 hour';
 for item in select * from (values('ip',ip_fingerprint,30),('key',key_fingerprint,5),('global','all',200)) as limits(scope,fingerprint,ceiling) loop
  select attempts into n from private.torn_login_limits l where l.scope=item.scope and l.fingerprint=item.fingerprint and l.bucket=minute;
  if coalesce(n,0)>=item.ceiling then return false;end if;
 end loop;
 -- Sign-in verifies /user/basic and /key/info: reserve both in the shared IP budget.
 select attempts into n from private.torn_data_budgets where scope='global' and subject='all' and bucket=minute;
 if coalesce(n,0)+2>5000 then return false;end if;
 insert into private.torn_data_budgets(scope,subject,bucket,attempts) values('global','all',minute,2)
 on conflict(scope,subject,bucket) do update set attempts=private.torn_data_budgets.attempts+2;
 insert into private.torn_login_limits(scope,fingerprint,bucket,attempts) values('ip',ip_fingerprint,minute,1),('key',key_fingerprint,minute,1),('global','all',minute,1)
 on conflict(scope,fingerprint,bucket) do update set attempts=private.torn_login_limits.attempts+1;
 return true;
end $$;
