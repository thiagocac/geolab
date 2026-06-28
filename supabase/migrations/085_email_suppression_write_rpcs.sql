-- 085_email_suppression_write_rpcs.sql
-- A6 (gestão de e-mails): escrita em email_suppressions via RPC, já que a tabela só tem policy de SELECT.
-- Ambas SECURITY DEFINER + search_path=public, autorizadas por has_role('admin_consulte') (mesmo papel da
-- policy de leitura sel_email_suppressions). email normalizado (lower/trim); add idempotente (on conflict).
-- grant só a authenticated. Aplicada em produção via MCP (apply_migration).
create or replace function public.email_suppression_add(p_email text, p_reason text default 'manual')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_role('admin_consulte') then raise exception 'not authorized'; end if;
  if coalesce(trim(p_email), '') = '' then raise exception 'email vazio'; end if;
  insert into email_suppressions (email, reason, metadata, created_at)
  values (lower(trim(p_email)), coalesce(nullif(trim(p_reason), ''), 'manual'), '{}'::jsonb, now())
  on conflict (email) do update set reason = excluded.reason;
end $$;

create or replace function public.email_suppression_remove(p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_role('admin_consulte') then raise exception 'not authorized'; end if;
  delete from email_suppressions where email = lower(trim(p_email));
end $$;

revoke all on function public.email_suppression_add(text, text) from public, anon;
revoke all on function public.email_suppression_remove(text) from public, anon;
grant execute on function public.email_suppression_add(text, text) to authenticated;
grant execute on function public.email_suppression_remove(text) to authenticated;
