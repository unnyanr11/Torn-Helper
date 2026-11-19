-- One batch marker event per collection; minute history backfills stay off the stream.
do $$
begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='stock_collection_status') then
  alter publication supabase_realtime add table public.stock_collection_status;
 end if;
end $$;
