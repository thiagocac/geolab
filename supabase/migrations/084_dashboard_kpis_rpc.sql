-- 084_dashboard_kpis_rpc.sql
-- KPIs do painel (Dashboard) agregados NO BANCO, para o painel não baixar agenda/laudos/equipamentos
-- só para contar. Reproduz exatamente a lógica anterior do getKpis (cálculo no cliente):
--   agenda  = CPs pendentes (situacao='pendente', nao deletados): atrasados (data_prevista < hoje),
--             hoje (= hoje), proximos (> hoje), total (todos os pendentes, inclusive sem data_prevista);
--   laudos  = lab_reports (nao deletados): emitido (status='emitido'), rascunho (qualquer outro/nulo), total;
--   calibracoes_vencendo = equipamentos (nao deletados) com validade_calibracao nos proximos 30 dias.
-- Isolamento: SECURITY DEFINER + autorizacao via is_tenant_member(p_tenant) (mesmo predicado do RLS);
-- caller nao-membro recebe zeros. grant so a authenticated. Aplicada em producao via MCP (apply_migration).
create or replace function public.dashboard_kpis(p_tenant uuid)
returns table (
  agenda_atrasados integer, agenda_hoje integer, agenda_proximos integer, agenda_total integer,
  laudos_rascunho integer, laudos_emitido integer, laudos_total integer,
  calibracoes_vencendo integer
)
language sql
stable
security definer
set search_path = public
as $$
  with ag as (
    select data_prevista_rompimento as d from corpos_prova
    where tenant_id = p_tenant and deleted_at is null and situacao = 'pendente' and is_tenant_member(p_tenant)
  ),
  lr as (
    select status from lab_reports
    where tenant_id = p_tenant and deleted_at is null and is_tenant_member(p_tenant)
  ),
  eq as (
    select 1 from equipamentos
    where tenant_id = p_tenant and deleted_at is null and is_tenant_member(p_tenant)
      and validade_calibracao is not null and validade_calibracao <= (current_date + 30)
  )
  select
    (select count(*) filter (where d < current_date) from ag)::int,
    (select count(*) filter (where d = current_date) from ag)::int,
    (select count(*) filter (where d > current_date) from ag)::int,
    (select count(*) from ag)::int,
    (select count(*) filter (where status is distinct from 'emitido') from lr)::int,
    (select count(*) filter (where status = 'emitido') from lr)::int,
    (select count(*) from lr)::int,
    (select count(*) from eq)::int;
$$;

revoke all on function public.dashboard_kpis(uuid) from public, anon;
grant execute on function public.dashboard_kpis(uuid) to authenticated;
