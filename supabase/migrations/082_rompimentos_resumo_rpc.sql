-- 082_rompimentos_resumo_rpc.sql
-- Contadores globais da tela de Rompimentos (pendente/atrasado/rompido/insatisfatorio) calculados NO BANCO,
-- para que a tela não precise baixar todos os corpos_prova só para somar (escala).
-- 'insatisfatorio' espelha EXATAMENTE o badge atual da tela (abaixo do fck em qualquer idade).
-- Isolamento: SECURITY DEFINER + autorização via is_tenant_member(p_tenant) (mesmo predicado do RLS);
-- caller não-membro recebe zeros. Aplicada em produção via MCP (apply_migration) em 2026-06-27.
create or replace function public.rompimentos_resumo(p_tenant uuid)
returns table (pendente integer, atrasado integer, rompido integer, insatisfatorio integer)
language sql
stable
security definer
set search_path = public
as $$
  with cp as (
    select c.situacao, c.data_prevista_rompimento,
           coalesce(c.valor_esperado, k.fck_previsto) as esperado,
           mt.resultado_valor
    from corpos_prova c
    left join concretagens k on k.id = c.concretagem_id
    left join lateral (
      select t.resultado_valor from material_tests t
      where t.corpo_prova_id = c.id and t.deleted_at is null and t.resultado_valor is not null
      order by t.created_at desc nulls last limit 1
    ) mt on true
    where c.tenant_id = p_tenant
      and c.deleted_at is null
      and is_tenant_member(p_tenant)
  )
  select
    count(*) filter (where resultado_valor is null and situacao = 'pendente')::int,
    count(*) filter (where resultado_valor is null and situacao = 'pendente' and data_prevista_rompimento < current_date)::int,
    count(*) filter (where resultado_valor is not null)::int,
    count(*) filter (where resultado_valor is not null and esperado is not null and resultado_valor < esperado)::int
  from cp;
$$;

revoke all on function public.rompimentos_resumo(uuid) from public, anon;
grant execute on function public.rompimentos_resumo(uuid) to authenticated;
