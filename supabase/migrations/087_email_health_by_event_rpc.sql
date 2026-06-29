-- A4: saude de e-mail por TIPO DE EVENTO, por tenant, agregado no banco a partir de
-- notification_dispatch_log (tem tenant_id). Mesmo padrao de seguranca do email_funnel (086):
-- SECURITY DEFINER + is_tenant_member(p_tenant) dentro da query (nao-membro recebe 0 linhas);
-- revoke public/anon, grant so authenticated. Janela em dias. Leitura pura, reversivel.
create or replace function public.email_health_by_event(p_tenant uuid, p_days integer default 30)
returns table (
  event_type text, total integer, enviados integer, entregues integer, abertos integer,
  bounces integer, reclamacoes integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    event_type,
    count(*)::int,
    count(*) filter (where status = 'sent')::int,
    count(delivered_at)::int,
    count(opened_at)::int,
    count(bounced_at)::int,
    count(complained_at)::int
  from notification_dispatch_log
  where tenant_id = p_tenant and deleted_at is null and is_tenant_member(p_tenant)
    and created_at >= (now() - make_interval(days => greatest(coalesce(p_days, 30), 1)))
  group by event_type
  order by count(*) desc
$$;
revoke all on function public.email_health_by_event(uuid, integer) from public, anon;
grant execute on function public.email_health_by_event(uuid, integer) to authenticated;
