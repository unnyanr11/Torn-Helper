-- Encryption material is generated in Vault, never embedded in code or exposed to browsers.
select vault.create_secret(encode(extensions.gen_random_bytes(32),'base64'),'tcc_torn_key_encryption')
where not exists(select 1 from vault.secrets where name='tcc_torn_key_encryption');
create function private.get_torn_key_encryption_secret() returns text
language plpgsql stable security definer set search_path='' as $$
declare result text;
begin
 if coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role',current_setting('role',true))<>'service_role' then raise exception 'Service only';end if;
 select decrypted_secret into result from vault.decrypted_secrets where name='tcc_torn_key_encryption';
 if result is null then raise exception 'Backend encryption is not configured';end if;
 return result;
end $$;
create function public.get_torn_key_encryption_secret() returns text language sql security invoker set search_path='' as $$ select private.get_torn_key_encryption_secret() $$;
revoke all on function private.get_torn_key_encryption_secret(),public.get_torn_key_encryption_secret() from public,anon,authenticated;
grant execute on function private.get_torn_key_encryption_secret(),public.get_torn_key_encryption_secret() to service_role;
