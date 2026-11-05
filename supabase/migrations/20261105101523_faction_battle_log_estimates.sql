-- Estimates are separate from confirmed snapshots. Raw logs never reach leaders.
alter table private.faction_battle_snapshots add column source text not null default 'official_api' check(source in ('official_api','log_estimate'));
alter table private.faction_battle_snapshots add column baseline_at timestamptz;
create table private.faction_battle_log_state (
 user_id uuid primary key references private.faction_battle_shares(user_id) on delete cascade,
 baseline_at timestamptz not null,
 checked_through bigint not null,
 reason text,
 updated_at timestamptz not null default now()
);
create table private.faction_battle_log_events (
 user_id uuid not null references private.faction_battle_shares(user_id) on delete cascade,
 log_id text not null,
 fingerprint text not null,
 primary key(user_id,log_id)
);
alter table private.faction_battle_log_state enable row level security;
alter table private.faction_battle_log_events enable row level security;
create policy battle_log_state_owner on private.faction_battle_log_state for select to authenticated using(user_id=(select auth.uid()));
create policy battle_log_event_owner on private.faction_battle_log_events for select to authenticated using(user_id=(select auth.uid()));
revoke all on private.faction_battle_log_state,private.faction_battle_log_events from public,anon,authenticated;
grant all on private.faction_battle_log_state,private.faction_battle_log_events to service_role;

create or replace function private.faction_battle_snapshot_json(b private.faction_battle_snapshots) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('observed_at',b.observed_at,'strength',b.strength::text,'defense',b.defense::text,'speed',b.speed::text,'dexterity',b.dexterity::text,'source',b.source,'baseline_at',b.baseline_at)
$$;
create function private.reset_battle_log_baseline() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.source='official_api' then
  insert into private.faction_battle_log_state(user_id,baseline_at,checked_through) values(new.user_id,new.observed_at,floor(extract(epoch from new.observed_at))::bigint)
  on conflict(user_id) do update set baseline_at=excluded.baseline_at,checked_through=excluded.checked_through,reason=null,updated_at=now();
  delete from private.faction_battle_log_events where user_id=new.user_id;
 end if;
 return new;
end $$;
create trigger reset_battle_log_baseline after insert on private.faction_battle_snapshots for each row execute function private.reset_battle_log_baseline();

-- Pure parser: explicit amounts only, never infer gains from energy, titles or percentages.
create function private.battle_log_delta(event jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare d jsonb:=event->'data'; result jsonb:='{}'; stat text; suffix text; amount numeric; change numeric; before_value numeric; after_value numeric; present boolean; paired boolean; key text; title text:=coalesce(event#>>'{details,title}','');
begin
 if jsonb_typeof(d) is distinct from 'object' then return jsonb_build_object('error','A log has no structured data.'); end if;
 if d ? 'stat' and coalesce(d->>'stat','') not in ('strength','defense','defence','speed','dexterity') then return jsonb_build_object('error','An unknown stat identifier needs reconciliation.');end if;
 if d ? 'stat' and d->>'stat' in ('strength','defense','defence','speed','dexterity') then
  foreach suffix in array array['increased','decreased','before','after'] loop
   if d ? ('stat_'||suffix) then d:=d||jsonb_build_object(replace(d->>'stat','defence','defense')||'_'||suffix,d->('stat_'||suffix));d:=d-('stat_'||suffix);end if;
  end loop;
 end if;
 if exists(select 1 from jsonb_object_keys(d) k where k like 'defence_%') then
  foreach suffix in array array['increased','decreased','before','after'] loop
   if d ? ('defence_'||suffix) then
    if d ? ('defense_'||suffix) then return jsonb_build_object('error','Ambiguous defence fields.');end if;
    d:=d||jsonb_build_object('defense_'||suffix,d->('defence_'||suffix));d:=d-('defence_'||suffix);
   end if;
  end loop;
 end if;
 foreach stat in array array['strength','defense','speed','dexterity'] loop
  change:=0;present:=false;paired:=d ? (stat||'_before') or d ? (stat||'_after');
  foreach suffix in array array['increased','decreased','before','after'] loop
   key:=stat||'_'||suffix;
   if d ? key then
    if jsonb_typeof(d->key) is distinct from 'number' or (d->>key)::numeric<0 or (d->>key)::numeric>=1e30 then return jsonb_build_object('error','Unsupported numeric battle-stat amount.');end if;
    if suffix in ('increased','decreased') then present:=true;change:=change+(case when suffix='increased' then 1 else -1 end)*(d->>key)::numeric;end if;
   end if;
  end loop;
  if paired then
   if not (d ? (stat||'_before') and d ? (stat||'_after')) then return jsonb_build_object('error','A stat log has only one side of a before/after pair.');end if;
   before_value:=(d->>(stat||'_before'))::numeric;after_value:=(d->>(stat||'_after'))::numeric;
   if present and change<>after_value-before_value then return jsonb_build_object('error','Conflicting stat changes in one log.');end if;
   change:=after_value-before_value;present:=true;
  end if;
  if present then result:=result||jsonb_build_object(stat,change);end if;
 end loop;
 if exists(select 1 from jsonb_object_keys(d) k where k ~* '(strength|defen[sc]e|speed|dexterity|battle.?stat|stat_)' and k not in ('stat') and k !~ '^(strength|defense|speed|dexterity)_(before|after|increased|decreased)$') then return jsonb_build_object('error','An unrecognized battle-stat field needs a fresh snapshot.');end if;
 if result='{}'::jsonb and (title ~* '(gym|train|battle.?stat|enhanc|overdose|job point|company special|education|book|drug|item use|consum)' or coalesce(event#>>'{details,category}','') ~* '(gym|education|drug|item|job|company|book)') then return jsonb_build_object('error','A potentially stat-changing log has no supported exact amount.');end if;
 return jsonb_build_object('delta',result);
end $$;

create function private.prepare_faction_battle_logs(consent boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); b private.faction_battle_snapshots; state private.faction_battle_log_state; finish bigint:=floor(extract(epoch from now()))::bigint-5;
begin
 if owner is null then raise exception 'Sign in with your Torn account.';end if;
 if consent is not true then raise exception 'Consent to private log processing first.';end if;
 perform 1 from public.profiles where id=owner for update;
 if not exists(select 1 from private.faction_battle_shares where user_id=owner) then raise exception 'Enable sharing and collect a confirmed baseline first.';end if;
 if exists(select 1 from public.profiles where id=owner and tracking_paused) then raise exception 'Resume tracking in Settings first.';end if;
 perform private.faction_battle_proof('v2-user-faction');
 select * into b from private.faction_battle_snapshots where user_id=owner and source='official_api' order by observed_at desc limit 1;
 if not found then raise exception 'Collect a confirmed baseline first.';end if;
 insert into private.faction_battle_log_state(user_id,baseline_at,checked_through) values(owner,b.observed_at,floor(extract(epoch from b.observed_at))::bigint) on conflict do nothing;
 select * into state from private.faction_battle_log_state where user_id=owner;
 if state.reason is not null then return jsonb_build_object('needs_baseline',true,'reason',state.reason);end if;
 if b.observed_at<now()-interval '7 days' then return jsonb_build_object('needs_baseline',true,'reason','The confirmed baseline is over seven days old. Reconcile with a fresh snapshot.');end if;
 if finish<=state.checked_through then return jsonb_build_object('waiting',true,'reason','Wait for a complete log interval before syncing again.');end if;
 return jsonb_build_object('parameters',jsonb_build_object('from',case when state.checked_through=floor(extract(epoch from state.baseline_at))::bigint then state.checked_through else state.checked_through+1 end::text,'to',finish::text,'limit','100'));
end $$;

create function private.sync_faction_battle_logs(parameters jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); state private.faction_battle_log_state; page public.torn_data_cache; latest private.faction_battle_snapshots; ev jsonb; parsed jsonb; deltas jsonb:='{"strength":0,"defense":0,"speed":0,"dexterity":0}'; seen jsonb:='{}'; stat text; event_id text; stamp bigint; from_stamp bigint; to_stamp bigint; expected bigint; old_hash text; fingerprint text; problem text; changed integer:=0; values_json jsonb; value numeric;
begin
 if owner is null then raise exception 'Sign in with your Torn account.';end if;
 perform 1 from public.profiles where id=owner for update;
 if exists(select 1 from public.profiles where id=owner and tracking_paused) then raise exception 'Resume tracking in Settings first.';end if;
 perform private.faction_battle_proof('v2-user-faction');
 select * into state from private.faction_battle_log_state where user_id=owner for update;
 if not found then raise exception 'Prepare a log sync first.';end if;
 if state.reason is not null then return jsonb_build_object('needs_baseline',true,'reason',state.reason);end if;
 if state.baseline_at<now()-interval '7 days' then return jsonb_build_object('needs_baseline',true,'reason','Reconcile the confirmed baseline first.');end if;
 if jsonb_typeof(parameters) is distinct from 'object' or (select count(*) from jsonb_object_keys(parameters))<>3 or not(parameters ?& array['from','to','limit']) or parameters->>'limit'<>'100' or parameters->>'from' !~ '^\d+$' or parameters->>'to' !~ '^\d+$' then raise exception 'Use an unfiltered bounded log window.';end if;
 from_stamp:=(parameters->>'from')::bigint;to_stamp:=(parameters->>'to')::bigint;
 if to_stamp<=state.checked_through then return jsonb_build_object('applied',0,'checked_through',state.checked_through,'cached',true);end if;
 expected:=case when state.checked_through=floor(extract(epoch from state.baseline_at))::bigint then state.checked_through else state.checked_through+1 end;
 if from_stamp<>expected or to_stamp<from_stamp or to_stamp>floor(extract(epoch from now()))::bigint-5 then raise exception 'The log window has a gap or is not yet complete.';end if;
 select * into page from public.torn_data_cache where user_id=owner and endpoint_id='v2-user-log' and public.torn_data_cache.parameters=sync_faction_battle_logs.parameters order by fetched_at desc limit 1;
 if not found or page.fetched_at<to_timestamp(to_stamp) or page.fetched_at<now()-interval '5 minutes' then raise exception 'Fetch this log interval with your own Torn key first.';end if;
 if jsonb_typeof(page.payload->'log') is distinct from 'array' then problem:='Torn did not return a complete log page.';
 elsif jsonb_array_length(page.payload->'log')>=100 or page.payload#>>'{_metadata,links,prev}' is not null then problem:='More log history may remain. A fresh snapshot is cheaper than replaying a long history.';
 elsif jsonb_typeof(page.payload#>'{_metadata,links}') is distinct from 'object' or not((page.payload#>'{_metadata,links}') ? 'prev') then problem:='Log pagination metadata is missing; coverage cannot be confirmed.';
 end if;
 if problem is null then
  for ev in select * from jsonb_array_elements(page.payload->'log') loop
   event_id:=ev->>'id';
   if jsonb_typeof(ev->'id') is distinct from 'string' or event_id is null or length(event_id)=0 or length(event_id)>200 or coalesce(ev->>'timestamp','') !~ '^\d+$' then problem:='A log has no stable ID or valid timestamp.';exit;end if;
   stamp:=(ev->>'timestamp')::bigint;
   if stamp<from_stamp or stamp>to_stamp then problem:='A log falls outside the requested interval.';exit;end if;
   fingerprint:=md5(ev::text);
   if seen ? event_id then
    if seen->>event_id<>fingerprint then problem:='Conflicting duplicate log IDs were returned.';exit;end if;
    continue;
   end if;
   seen:=seen||jsonb_build_object(event_id,fingerprint);
   select e.fingerprint into old_hash from private.faction_battle_log_events e where e.user_id=owner and e.log_id=event_id;
   if old_hash is not null then
    if old_hash<>fingerprint then problem:='A previously processed log changed.';exit;end if;
    continue;
   end if;
   parsed:=private.battle_log_delta(ev);
   if parsed ? 'error' then problem:=parsed->>'error';exit;end if;
   if parsed->'delta'<>'{}'::jsonb then
    if stamp<=floor(extract(epoch from state.baseline_at))::bigint then problem:='A stat change shares the baseline second; its order is unknown. Reconcile a fresh snapshot.';exit;end if;
    foreach stat in array array['strength','defense','speed','dexterity'] loop deltas:=jsonb_set(deltas,array[stat],to_jsonb((deltas->>stat)::numeric+coalesce((parsed#>>array['delta',stat])::numeric,0)));end loop;
    changed:=changed+1;
   end if;
  end loop;
 end if;
 if problem is null then
  select * into latest from private.faction_battle_snapshots where user_id=owner order by observed_at desc limit 1;
  values_json:=private.faction_battle_snapshot_json(latest);
  foreach stat in array array['strength','defense','speed','dexterity'] loop
   value:=(values_json->>stat)::numeric+(deltas->>stat)::numeric;
   if value<0 or value>=1e30 then problem:='Known changes exceed the saved stats; logs may be missing.';exit;end if;
   values_json:=jsonb_set(values_json,array[stat],to_jsonb(value));
  end loop;
 end if;
 if problem is not null then
  update private.faction_battle_log_state set reason=problem,updated_at=now() where user_id=owner;
  return jsonb_build_object('needs_baseline',true,'reason',problem);
 end if;
 if changed>0 then
  insert into private.faction_battle_snapshots(user_id,faction_id,observed_at,strength,defense,speed,dexterity,source,baseline_at)
  values(owner,latest.faction_id,to_timestamp(to_stamp),(values_json->>'strength')::numeric,(values_json->>'defense')::numeric,(values_json->>'speed')::numeric,(values_json->>'dexterity')::numeric,'log_estimate',state.baseline_at);
 end if;
 insert into private.faction_battle_log_events(user_id,log_id,fingerprint) select owner,entry.key,entry.value from jsonb_each_text(seen) entry on conflict do nothing;
 update private.faction_battle_log_state set checked_through=to_stamp,updated_at=now() where user_id=owner;
 return jsonb_build_object('applied',changed,'checked_through',to_stamp,'source','log_estimate');
end $$;

alter function private.my_faction_battle_sharing() rename to my_faction_battle_sharing_snapshot;
create function private.my_faction_battle_sharing() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin return private.my_faction_battle_sharing_snapshot()||jsonb_build_object('log_sync',(select jsonb_build_object('checked_through',checked_through,'baseline_at',baseline_at,'reason',reason) from private.faction_battle_log_state where user_id=auth.uid()));end $$;
alter function private.faction_battle_dashboard(integer) rename to faction_battle_dashboard_snapshots;
create function private.faction_battle_dashboard(window_days integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 result:=private.faction_battle_dashboard_snapshots(window_days);
 return jsonb_set(result,'{members}',(select coalesce(jsonb_agg(m||jsonb_build_object('log_sync',(select jsonb_build_object('checked_through',s.checked_through,'baseline_at',s.baseline_at,'reason',s.reason) from private.faction_battle_log_state s join private.faction_battle_shares share on share.user_id=s.user_id where share.torn_id=(m->>'id')::bigint and share.faction_id=(result->>'faction_id')::bigint))),'[]') from jsonb_array_elements(result->'members') m));
end $$;
create function public.prepare_faction_battle_logs(consent boolean) returns jsonb language sql security invoker set search_path='' as $$ select private.prepare_faction_battle_logs(consent) $$;
create function public.sync_faction_battle_logs(parameters jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.sync_faction_battle_logs(parameters) $$;
revoke all on function private.my_faction_battle_sharing_snapshot(),private.faction_battle_dashboard_snapshots(integer),private.reset_battle_log_baseline(),private.battle_log_delta(jsonb) from public,anon,authenticated;
revoke all on function private.my_faction_battle_sharing(),private.faction_battle_dashboard(integer),private.prepare_faction_battle_logs(boolean),private.sync_faction_battle_logs(jsonb),public.prepare_faction_battle_logs(boolean),public.sync_faction_battle_logs(jsonb) from public,anon,authenticated;
grant execute on function private.my_faction_battle_sharing(),private.faction_battle_dashboard(integer),private.prepare_faction_battle_logs(boolean),private.sync_faction_battle_logs(jsonb),public.prepare_faction_battle_logs(boolean),public.sync_faction_battle_logs(jsonb) to authenticated;

-- Automatic processing requires the member's updated sharing disclosure and a retained key.
alter table private.faction_battle_shares add column log_tracking_consent boolean not null default false;
alter table private.faction_battle_shares add column next_sync_at timestamptz not null default now();
alter table private.faction_battle_shares add column sync_lease_until timestamptz;
alter table private.faction_battle_shares add column sync_token uuid;
alter table private.faction_battle_shares add column sync_error text;
alter table private.faction_battle_shares add column last_sync_at timestamptz;
create function private.enable_automatic_faction_stats() returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first.';end if;
 if not exists(select 1 from public.encrypted_credentials where user_id=auth.uid() and provider='torn') then raise exception 'Save an encrypted Full Access Torn key in Settings for automatic updates.';end if;
 update private.faction_battle_shares set log_tracking_consent=true,next_sync_at=now(),sync_error=null where user_id=auth.uid();
 if not found then raise exception 'Share a confirmed baseline first.';end if;
 return true;
end $$;
create function public.enable_automatic_faction_stats() returns boolean language sql security invoker set search_path='' as $$ select private.enable_automatic_faction_stats() $$;
revoke all on function private.enable_automatic_faction_stats(),public.enable_automatic_faction_stats() from public,anon,authenticated;
grant execute on function private.enable_automatic_faction_stats(),public.enable_automatic_faction_stats() to authenticated;

create function private.require_battle_worker() returns void language plpgsql stable security invoker set search_path='' as $$
begin
 if coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role',current_setting('role',true))<>'service_role' then raise exception 'Service only';end if;
end $$;
create function private.claim_faction_battle_jobs() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.require_battle_worker();
 with due as (
  select s.user_id from private.faction_battle_shares s join public.profiles p on p.id=s.user_id
  join public.linked_torn_accounts a on a.user_id=s.user_id and a.revoked_at is null
  where s.log_tracking_consent and not p.tracking_paused and s.next_sync_at<=now() and (s.sync_lease_until is null or s.sync_lease_until<now())
  and exists(select 1 from public.encrypted_credentials e where e.user_id=s.user_id and e.provider='torn')
  order by s.next_sync_at,s.user_id for update of s skip locked limit 10
 ), claimed as (
  update private.faction_battle_shares s set sync_token=gen_random_uuid(),sync_lease_until=now()+interval '90 seconds' from due where due.user_id=s.user_id returning s.user_id,s.sync_token
 ) select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'token',sync_token)),'[]') into result from claimed;
 return result;
end $$;
create function private.faction_battle_worker(owner_id uuid,token uuid,action text,parameters jsonb default '{}',failure text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old_sub text:=current_setting('request.jwt.claim.sub',true); result jsonb;
begin
 perform private.require_battle_worker();
 perform 1 from public.profiles where id=owner_id and not tracking_paused for update;
 if not found then return jsonb_build_object('skipped',true);end if;
 perform 1 from private.faction_battle_shares where user_id=owner_id and log_tracking_consent and sync_token=token and sync_lease_until>=now() for update;
 if not found then return jsonb_build_object('skipped',true);end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 if action='check' then result:=jsonb_build_object('active',true);
 elsif action='prepare' then result:=private.prepare_faction_battle_logs(true);
 elsif action='apply' then result:=private.sync_faction_battle_logs(parameters);
 elsif action='baseline' then result:=private.set_faction_battle_sharing(true);
 elsif action='finish' then
  update private.faction_battle_shares set sync_error=left(failure,300),last_sync_at=case when failure is null then now() else last_sync_at end,
   next_sync_at=now()+case when failure is null then interval '5 minutes' else interval '6 hours' end,sync_lease_until=null,sync_token=null where user_id=owner_id and sync_token=token;
  result:=jsonb_build_object('finished',true);
 else raise exception 'Unsupported worker action';end if;
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
 return result;
exception when others then
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);raise;
end $$;
create function public.claim_faction_battle_jobs() returns jsonb language sql security invoker set search_path='' as $$ select private.claim_faction_battle_jobs() $$;
create function public.faction_battle_worker(owner_id uuid,token uuid,action text,parameters jsonb default '{}',failure text default null) returns jsonb language sql security invoker set search_path='' as $$ select private.faction_battle_worker(owner_id,token,action,parameters,failure) $$;
revoke all on function private.require_battle_worker(),private.claim_faction_battle_jobs(),private.faction_battle_worker(uuid,uuid,text,jsonb,text),public.claim_faction_battle_jobs(),public.faction_battle_worker(uuid,uuid,text,jsonb,text) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.claim_faction_battle_jobs(),private.faction_battle_worker(uuid,uuid,text,jsonb,text),public.claim_faction_battle_jobs(),public.faction_battle_worker(uuid,uuid,text,jsonb,text) to service_role;
-- Calculations are now automatic; browser clients cannot invoke the low-level processing RPCs.
revoke execute on function private.prepare_faction_battle_logs(boolean),private.sync_faction_battle_logs(jsonb),public.prepare_faction_battle_logs(boolean),public.sync_faction_battle_logs(jsonb) from authenticated;

create or replace function private.my_faction_battle_sharing() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin return private.my_faction_battle_sharing_snapshot()||jsonb_build_object('automatic',(select jsonb_build_object('enabled',s.log_tracking_consent,'last_sync_at',s.last_sync_at,'next_sync_at',s.next_sync_at,'error',s.sync_error,'key_saved',exists(select 1 from public.encrypted_credentials e where e.user_id=s.user_id and e.provider='torn')) from private.faction_battle_shares s where s.user_id=auth.uid()),'log_sync',(select jsonb_build_object('checked_through',checked_through,'baseline_at',baseline_at,'reason',reason) from private.faction_battle_log_state where user_id=auth.uid()));end $$;

-- Reuse a matching complete interval collected by another feature without a new Torn call.
create function private.apply_cached_battle_logs() returns trigger language plpgsql security definer set search_path='' as $$
declare old_sub text:=current_setting('request.jwt.claim.sub',true); state private.faction_battle_log_state; expected bigint;
begin
 if new.endpoint_id<>'v2-user-log' then return new;end if;
 if not exists(select 1 from private.faction_battle_shares where user_id=new.user_id and log_tracking_consent) then return new;end if;
 select * into state from private.faction_battle_log_state where user_id=new.user_id;
 if not found then return new;end if;
 expected:=case when state.checked_through=floor(extract(epoch from state.baseline_at))::bigint then state.checked_through else state.checked_through+1 end;
 if new.parameters->>'from' is distinct from expected::text or new.parameters->>'limit'<>'100' then return new;end if;
 perform set_config('request.jwt.claim.sub',new.user_id::text,true);
 begin perform private.sync_faction_battle_logs(new.parameters);exception when others then null;end;
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);return new;
end $$;
revoke all on function private.apply_cached_battle_logs() from public,anon,authenticated;
create trigger apply_cached_battle_logs after insert or update on public.torn_data_cache for each row execute function private.apply_cached_battle_logs();

create function private.resume_battle_stats_on_key_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.provider='torn' then update private.faction_battle_shares set next_sync_at=now(),sync_error=null where user_id=new.user_id;end if;return new;
end $$;
revoke all on function private.resume_battle_stats_on_key_change() from public,anon,authenticated;
create trigger resume_battle_stats_on_key_change after insert or update on public.encrypted_credentials for each row execute function private.resume_battle_stats_on_key_change();
select cron.schedule('sync-faction-battle-stats','* * * * *',$job$select net.http_post(url:='https://caxhhhtrlqfuatraamto.supabase.co/functions/v1/sync-faction-battle-stats',headers:=jsonb_build_object('Content-Type','application/json','x-job-token',(select decrypted_secret from vault.decrypted_secrets where name='tcc_job_token')),body:='{}'::jsonb);$job$);
