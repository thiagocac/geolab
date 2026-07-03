-- 136_rompimentos_resumo_idade_controle_por_traco (APLICADA 02/07/2026 via MCP) — registro fiel.
-- Insatisfatório resolve idade de controle POR CP: traço (135) > config_lab > 28. Grants preservados.
create or replace function public.rompimentos_resumo(p_tenant uuid)
returns table(pendente integer, atrasado integer, rompido integer, insatisfatorio integer)
language sql
stable security definer
set search_path to 'public'
as $function$
  with cfg as (
    select coalesce((select idade_controle_default from config_lab where tenant_id = p_tenant), 28) as idade_ctrl
  ),
  cp as (
    select c.situacao, c.data_prevista_rompimento, c.idade_dias, c.idade_unidade,
           coalesce(c.valor_esperado, k.fck_previsto) as esperado,
           coalesce(om.idade_controle_dias, (select idade_ctrl from cfg)) as idade_ctrl_cp,
           mt.resultado_valor
    from corpos_prova c
    left join concretagens k on k.id = c.concretagem_id
    left join operational_materials om on om.id = k.operational_material_id
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
    count(*) filter (where resultado_valor is not null and esperado is not null and resultado_valor < esperado
                     and idade_unidade is distinct from 'hora'
                     and idade_dias = idade_ctrl_cp)::int
  from cp;
$function$;
