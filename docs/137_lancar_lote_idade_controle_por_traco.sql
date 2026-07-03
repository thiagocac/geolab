-- 137_lancar_lote_idade_controle_por_traco (APLICADA 02/07/2026 via MCP) — registro fiel.
-- Alerta abaixo-do-fck do lote resolve idade de controle por amostra via traço; payload = fallback.
create or replace function public.lancar_rompimentos_lote(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_itens jsonb := coalesce(payload->'itens', '[]'::jsonb);
  v_idade_controle int := coalesce(nullif(payload->>'idade_controle','')::int, 28);
  v_item jsonb; v_res jsonb;
  v_ok int := 0;
  v_resultados jsonb := '[]'::jsonb;
  v_abaixo jsonb := '[]'::jsonb;
  v_cp_ids uuid[] := '{}';
  v_ex numeric;
  r record;
begin
  if not public.is_tenant_writer() then raise exception 'sem permissao para lancar rompimento'; end if;
  for v_item in select value from jsonb_array_elements(v_itens) loop
    v_res := public.lancar_rompimento_cp(v_item);
    v_ok := v_ok + 1;
    v_resultados := v_resultados || jsonb_build_array(v_res);
    v_cp_ids := v_cp_ids || (nullif(v_item->>'corpo_prova_id','')::uuid);
  end loop;
  for r in
    select distinct cp.amostra_id as amostra_id, cp.codigo as codigo,
           coalesce(cp.valor_esperado, cg.fck_previsto) as fck,
           coalesce(om.idade_controle_dias, v_idade_controle) as idade_ctrl
    from public.corpos_prova cp
    join public.concretagens cg on cg.id = cp.concretagem_id
    left join public.operational_materials om on om.id = cg.operational_material_id
    where cp.id = any(v_cp_ids) and cp.amostra_id is not null
  loop
    select max(mt.resultado_valor) into v_ex
    from public.material_tests mt
    join public.corpos_prova s on s.id = mt.corpo_prova_id
    where s.amostra_id = r.amostra_id and s.deleted_at is null and mt.deleted_at is null
      and mt.idade_dias = r.idade_ctrl and mt.idade_unidade <> 'hora';
    if r.fck is not null and r.fck > 0 and v_ex is not null and v_ex < r.fck then
      v_abaixo := v_abaixo || jsonb_build_array(jsonb_build_object('amostra_id', r.amostra_id, 'codigo', r.codigo, 'exemplar', v_ex, 'fck', r.fck));
    end if;
  end loop;
  return jsonb_build_object('ok', v_ok, 'resultados', v_resultados, 'abaixo_fck', v_abaixo);
end; $function$;
