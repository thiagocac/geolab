-- A2: funil de entrega de e-mail + taxas (bounce/complaint) por tenant, agregado NO BANCO a partir de
-- notification_dispatch_log (que TEM tenant_id, ao contrario da view v_email_dispatch_daily, global).
-- Isolamento: SECURITY DEFINER + is_tenant_member(p_tenant) dentro da query (nao-membro recebe zeros);
-- revoke public/anon, grant so authenticated. Janela em dias (default 30). Leitura pura, reversivel.
-- Aplicada em producao via MCP (apply_migration).
create or replace function public.email_funnel(p_tenant uuid, p_days integer default 30)
returns table (
  total integer, enviados integer, entregues integer, abertos integer, clicados integer,
  bounces integer, reclamacoes integer, suprimidos integer, falhas integer
)
language sql
stable
security definer
set search_path = public
as $$
  with d as (
    select status, delivered_at, opened_at, clicked_at, bounced_at, complained_at
    from notification_dispatch_log
    where tenant_id = p_tenant and deleted_at is null and is_tenant_member(p_tenant)
      and created_at >= (now() - make_interval(days => greatest(coalesce(p_days, 30), 1)))
  )
  select
    count(*)::int,
    count(*) filter (where status = 'sent')::int,
    count(*) filter (where delivered_at is not null)::int,
    count(*) filter (where opened_at is not null)::int,
    count(*) filter (where clicked_at is not null)::int,
    count(*) filter (where bounced_at is not null)::int,
    count(*) filter (where complained_at is not null)::int,
    count(*) filter (where status in ('suppressed','skipped'))::int,
    count(*) filter (where status = 'failed')::int
  from d
$$;
revoke all on function public.email_funnel(uuid, integer) from public, anon;
grant execute on function public.email_funnel(uuid, integer) to authenticated;
