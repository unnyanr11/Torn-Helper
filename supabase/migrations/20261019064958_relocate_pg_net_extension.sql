-- Supabase-supported remediation for extension_in_public on non-relocatable pg_net.
-- https://supabase.com/docs/guides/database/extensions/pg_net#troubleshooting
-- Run atomically. No CASCADE: unexpected application dependencies abort the change.
-- Pause net-calling cron jobs beforehand and restore their exact active state afterward.
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $migration$
declare
 installed_version text;
 installed_schema text;
 sequence_value bigint;
 sequence_called boolean;
 response_count bigint;
begin
 select e.extversion,n.nspname into installed_version,installed_schema
 from pg_catalog.pg_extension e join pg_catalog.pg_namespace n on n.oid=e.extnamespace
 where e.extname='pg_net';
 if not found then raise exception 'pg_net must already be installed'; end if;
 if installed_schema='extensions' then return; end if;
 if installed_schema<>'public' then raise exception 'Unexpected pg_net schema: %',installed_schema; end if;
 if exists(select 1 from cron.job_run_details r join cron.job j on j.jobid=r.jobid where j.command like '%net.http%' and r.status in ('starting','running','connecting','sending')) then
   raise exception 'A pg_net cron job is still running; wait before retrying';
 end if;
 -- Block new enqueue/response writes while copying and recreating the internal objects.
 lock table net.http_request_queue,net._http_response in access exclusive mode;
 if exists(select 1 from net.http_request_queue) then
   raise exception 'pg_net queue is not empty; drain requests before retrying';
 end if;
 if exists(select 1 from pg_catalog.pg_stat_activity where backend_type like 'pg_net % worker' and state<>'idle') then
   raise exception 'pg_net worker is busy; wait for pending responses before retrying';
 end if;
 create temporary table tcc_saved_net_responses on commit drop as select * from net._http_response;
 select count(*) into response_count from pg_temp.tcc_saved_net_responses;
 select last_value,is_called into sequence_value,sequence_called from net.http_request_queue_id_seq;
 create schema if not exists extensions;
 drop extension pg_net;
 execute format('create extension pg_net with schema extensions version %L',installed_version);
 insert into net._http_response select * from pg_temp.tcc_saved_net_responses;
 perform pg_catalog.setval('net.http_request_queue_id_seq'::regclass,sequence_value,sequence_called);
 if (select count(*) from net._http_response)<>response_count then
   raise exception 'pg_net response restoration failed';
 end if;
 if not exists(select 1 from pg_catalog.pg_extension e join pg_catalog.pg_namespace n on n.oid=e.extnamespace where e.extname='pg_net' and e.extversion=installed_version and n.nspname='extensions') then
   raise exception 'pg_net schema/version verification failed';
 end if;
end
$migration$;
