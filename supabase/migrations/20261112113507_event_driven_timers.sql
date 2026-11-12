-- A baseline is durable; clock ticks and expiry never need an upstream request.
create table public.torn_timer_baselines(
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint_id text not null,
 payload jsonb not null,
 observed_at timestamptz not null,
 deadlines jsonb not null default '{}'::jsonb,
 primary key(user_id,endpoint_id),
 check(endpoint_id in ('v2-user-bars','v2-user-cooldowns','v2-user-travel','v2-user-education','v2-user-organizedcrime','v2-user-races','v2-user-profile','v2-faction-chain'))
);
create table public.torn_timer_sync_status(
 user_id uuid primary key references auth.users(id) on delete cascade,
 checked_through bigint not null,
 next_check_at timestamptz not null default now(),
 status text not null default 'waiting',
 message text,
 updated_at timestamptz not null default now()
);
alter table public.torn_timer_baselines enable row level security;
alter table public.torn_timer_sync_status enable row level security;
create policy timer_baseline_owner on public.torn_timer_baselines for select to authenticated using(user_id=(select auth.uid()));
create policy timer_status_owner on public.torn_timer_sync_status for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.torn_timer_baselines,public.torn_timer_sync_status from public,anon,authenticated;
grant select on public.torn_timer_baselines,public.torn_timer_sync_status to authenticated;
grant all on public.torn_timer_baselines,public.torn_timer_sync_status to service_role;
create table private.torn_timer_jobs(
 user_id uuid primary key references auth.users(id) on delete cascade,
 cursor_to bigint not null,
 scan_to bigint,
 next_parameters jsonb,
 pending_endpoints text[] not null default '{}',
 next_check_at timestamptz not null default now()+interval '2 minutes',
 lease_token uuid,
 lease_until timestamptz
);
create index timer_jobs_due on private.torn_timer_jobs(next_check_at);
alter table private.torn_timer_jobs enable row level security;
create policy timer_job_service on private.torn_timer_jobs to service_role using(true) with check(true);
revoke all on private.torn_timer_jobs from public,anon,authenticated;
grant all on private.torn_timer_jobs to service_role;

create function private.timer_deadlines(endpoint text,payload jsonb,observed_at timestamptz) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb:='{}'; r record; value numeric; base numeric:=extract(epoch from observed_at); bar jsonb; name text; n numeric; inc numeric; tick numeric; step numeric; maximum numeric;
begin
 -- Whitelist field meaning: arbitrary timestamps and numbers are never treated as timers.
 for r in select * from (values
 ('v2-user-cooldowns','drug','cooldowns,drug',false),('v2-user-cooldowns','medical','cooldowns,medical',false),('v2-user-cooldowns','booster','cooldowns,booster',false),
 ('v2-user-travel','travel','travel,time_left',false),('v2-user-travel','arrival','travel,arrival_at',true),
 ('v2-user-education','education','education,current,until',true),('v2-user-education','education_remaining','education,current,time_left',false),
 ('v2-user-organizedcrime','organized_crime','organizedcrime,ready_at',true),
 ('v2-user-profile','status','profile,status,until',true),('v2-faction-chain','chain','chain,timeout',false)
 ) as fields(source,label,path,absolute) where source=endpoint loop
  if jsonb_typeof(payload #> string_to_array(r.path,','))='number' then
   value:=(payload #>> string_to_array(r.path,','))::numeric;
   if value>=0 and value<1e11 and (not r.absolute or value>0) then result:=result||jsonb_build_object(r.label,case when r.absolute then value else base+value end);end if;
  end if;
 end loop;
 if endpoint='v2-user-bars' then
  foreach name in array array['energy','nerve','happy','life'] loop
   bar:=payload#>array['bars',name];
   if jsonb_typeof(bar->'current')='number' and jsonb_typeof(bar->'maximum')='number' and jsonb_typeof(bar->'increment')='number' and jsonb_typeof(bar->'interval')='number' and jsonb_typeof(bar->'tick_time')='number' then
    n:=(bar->>'current')::numeric;maximum:=(bar->>'maximum')::numeric;inc:=(bar->>'increment')::numeric;step:=(bar->>'interval')::numeric;tick:=(bar->>'tick_time')::numeric;
    if n>=0 and maximum>0 and inc>0 and step between 1 and 86400 and tick between 0 and step then
     result:=result||jsonb_build_object(name||'_full',base+case when n>=maximum then 0 else tick+greatest(0,ceil((maximum-n)/inc)-1)*step end);
    end if;
   end if;
  end loop;
 end if;
 return result;
end $$;
revoke all on function private.timer_deadlines(text,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function private.timer_deadlines(text,jsonb,timestamptz) to service_role;

-- Runs only after an actual accepted observation, including a manual refresh.
create function private.capture_timer_baseline() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.endpoint_id not in ('v2-user-bars','v2-user-cooldowns','v2-user-travel','v2-user-education','v2-user-organizedcrime','v2-user-races','v2-user-profile','v2-faction-chain') then return new;end if;
 -- Targeted lookups must not replace the signed-in player's own baseline.
 if exists(select 1 from jsonb_object_keys(new.parameters) p where p not in ('timestamp','comment')) then return new;end if;
 insert into public.torn_timer_baselines(user_id,endpoint_id,payload,observed_at,deadlines)
 values(new.user_id,new.endpoint_id,new.payload,new.fetched_at,private.timer_deadlines(new.endpoint_id,new.payload,new.fetched_at))
 on conflict(user_id,endpoint_id) do update set payload=excluded.payload,observed_at=excluded.observed_at,deadlines=excluded.deadlines where torn_timer_baselines.observed_at<excluded.observed_at;
 insert into private.torn_timer_jobs(user_id,cursor_to) values(new.user_id,floor(extract(epoch from new.fetched_at))::bigint) on conflict do nothing;
 insert into public.torn_timer_sync_status(user_id,checked_through,next_check_at) values(new.user_id,floor(extract(epoch from new.fetched_at))::bigint,now()+interval '2 minutes') on conflict do nothing;
 return new;
end $$;
revoke all on function private.capture_timer_baseline() from public,anon,authenticated;
create trigger capture_timer_baseline after insert or update of payload,fetched_at on public.torn_data_cache for each row execute function private.capture_timer_baseline();
-- Seed from real saved observations without calling Torn or modifying their timestamps.
insert into public.torn_timer_baselines(user_id,endpoint_id,payload,observed_at,deadlines)
 select distinct on(user_id,endpoint_id) user_id,endpoint_id,payload,fetched_at,private.timer_deadlines(endpoint_id,payload,fetched_at) from public.torn_data_cache c
 where endpoint_id in ('v2-user-bars','v2-user-cooldowns','v2-user-travel','v2-user-education','v2-user-organizedcrime','v2-user-races','v2-user-profile','v2-faction-chain') and not exists(select 1 from jsonb_object_keys(c.parameters) p where p not in ('timestamp','comment'))
 order by user_id,endpoint_id,fetched_at desc;
insert into private.torn_timer_jobs(user_id,cursor_to) select user_id,floor(extract(epoch from min(observed_at)))::bigint from public.torn_timer_baselines group by user_id;
insert into public.torn_timer_sync_status(user_id,checked_through,next_check_at) select user_id,cursor_to,next_check_at from private.torn_timer_jobs;

create function private.claim_timer_jobs(requested_owner uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb:='[]'; j private.torn_timer_jobs; token uuid;
begin
 for j in select t.* from private.torn_timer_jobs t join public.profiles p on p.id=t.user_id join public.linked_torn_accounts a on a.user_id=t.user_id
 where t.next_check_at<=now() and (t.lease_until is null or t.lease_until<now()) and not p.tracking_paused and a.revoked_at is null
 and (requested_owner is null or requested_owner=t.user_id) and exists(select 1 from public.encrypted_credentials k where k.user_id=t.user_id and k.provider='torn')
 order by t.next_check_at,t.user_id limit 3 for update of t skip locked loop
  token:=gen_random_uuid();update private.torn_timer_jobs set lease_token=token,lease_until=now()+interval '2 minutes' where user_id=j.user_id;
  result:=result||jsonb_build_array(jsonb_build_object('user_id',j.user_id,'token',token,'cursor_to',j.cursor_to,'scan_to',j.scan_to,'next_parameters',j.next_parameters,'pending_endpoints',j.pending_endpoints));
 end loop;
 return result;
end $$;
create function public.claim_timer_jobs(requested_owner uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.claim_timer_jobs(requested_owner)$$;
create function private.finish_timer_job(owner_id uuid,job_token uuid,result jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare j private.torn_timer_jobs; cursor_value bigint; retry integer;
begin
 select * into j from private.torn_timer_jobs where user_id=owner_id and lease_token=job_token and lease_until>now() for update;
 if not found then return false;end if;
 cursor_value:=greatest(j.cursor_to,(result->>'cursor_to')::bigint);retry:=least(3600,greatest(60,(result->>'retry_seconds')::integer));
 update private.torn_timer_jobs set cursor_to=cursor_value,scan_to=(result->>'scan_to')::bigint,next_parameters=nullif(result->'next_parameters','null'::jsonb),pending_endpoints=array(select jsonb_array_elements_text(result->'pending_endpoints')),next_check_at=date_trunc('minute',now())+make_interval(secs=>retry),lease_token=null,lease_until=null where user_id=owner_id;
 update public.torn_timer_sync_status set checked_through=cursor_value,next_check_at=date_trunc('minute',now())+make_interval(secs=>retry),status=case when result->>'error' is not null then 'attention' when result->>'scan_to' is not null then 'catching_up' else 'watching' end,message=left(result->>'error',250),updated_at=now() where user_id=owner_id;
 return true;
end $$;
create function public.finish_timer_job(owner_id uuid,job_token uuid,result jsonb) returns boolean language sql security invoker set search_path='' as $$select private.finish_timer_job(owner_id,job_token,result)$$;
revoke all on function private.claim_timer_jobs(uuid),public.claim_timer_jobs(uuid),private.finish_timer_job(uuid,uuid,jsonb),public.finish_timer_job(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.claim_timer_jobs(uuid),public.claim_timer_jobs(uuid),private.finish_timer_job(uuid,uuid,jsonb),public.finish_timer_job(uuid,uuid,jsonb) to service_role;
-- Resuming tracking or replacing a key makes permission-backoff immediately retryable.
create function private.wake_timer_tracking() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update private.torn_timer_jobs set next_check_at=now()+interval '2 minutes' where user_id=new.user_id;return new;
end $$;
revoke all on function private.wake_timer_tracking() from public,anon,authenticated;
create trigger wake_timer_tracking after insert or update of encrypted_key on public.encrypted_credentials for each row when(new.provider='torn') execute function private.wake_timer_tracking();
-- Realtime pushes only changed baselines/status; a browser second tick has no network work.
alter publication supabase_realtime add table public.torn_timer_baselines,public.torn_timer_sync_status;
select cron.schedule('sync-timers','* * * * *',$job$select net.http_post(url:='https://caxhhhtrlqfuatraamto.supabase.co/functions/v1/sync-timers',headers:=jsonb_build_object('Content-Type','application/json','x-job-token',(select decrypted_secret from vault.decrypted_secrets where name='tcc_job_token')),body:='{}'::jsonb,timeout_milliseconds:=60000);$job$);
create function private.resume_timer_tracking() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.tracking_paused and not new.tracking_paused then update private.torn_timer_jobs set next_check_at=now() where user_id=new.id;end if;return new;
end $$;
revoke all on function private.resume_timer_tracking() from public,anon,authenticated;
create trigger resume_timer_tracking after update of tracking_paused on public.profiles for each row execute function private.resume_timer_tracking();
