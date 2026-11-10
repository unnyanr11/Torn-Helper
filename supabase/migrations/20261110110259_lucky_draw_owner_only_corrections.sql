-- Only a database-owner SQL session may inspect sealed rows or correct names.
-- Worker SECURITY DEFINER functions retain narrowly scoped automatic processing.
revoke all on private.lucky_draw_winners, private.lucky_draw_name_audit
 from public, anon, authenticated, service_role;
revoke all on function public.admin_correct_lucky_draw_name(uuid,integer,text,text),
 private.admin_correct_lucky_draw_name(uuid,integer,text,text),
 private.can_correct_lucky_draw_name()
 from public, anon, authenticated, service_role;

create or replace function private.can_correct_lucky_draw_name() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(nullif(current_setting('role',true),'none'),session_user::text)
  = pg_get_userbyid(datdba)
 from pg_catalog.pg_database where datname=current_database();
$$;
comment on function public.admin_correct_lucky_draw_name(uuid,integer,text,text)
 is 'Database-owner SQL only: audited display-name correction; winning identity remains immutable.';
