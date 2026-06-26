-- 067 (F1): teto server-side de 5000 CPs em fn_resultados_por_obras (guardrail p/ clientes com muitas obras).
-- CREATE OR REPLACE (sem mudança de assinatura). Corpo igual à 063 + 'limit 5000'. O frontend avisa quando atinge o teto.
create or replace function public.fn_resultados_por_obras(p_work_ids uuid[])
returns table(
  work_id uuid, work_nome text, client_id uuid,
  concretagem_id uuid, concretagem_codigo text, data_concretagem date,
  local_texto text, fornecedor_texto text, fck_previsto numeric,
  amostra_id uuid, amostra_codigo text,
  receipt_id uuid, nota_fiscal text, serie text,
  cp_id uuid, cp_codigo text, numeracao_lab text,
  idade_dias integer, idade_unidade text,
  data_moldagem date, data_prevista_rompimento date, data_real_rompimento date, situacao text,
  material_test_type_id uuid, idade_controle integer,
  resultado_valor numeric, carga_ruptura_kn numeric, cp_diametro_mm numeric, cp_altura_mm numeric,
  tipo_ruptura text, data_rompimento date,
  is_controle boolean, fck_ref numeric, conforme boolean
)
language sql stable security definer set search_path to 'public' as $$
  select
    w.id, w.nome, c.client_id,
    c.id, c.codigo, coalesce(c.data_real, c.data_programada),
    c.local_texto, c.fornecedor_texto, c.fck_previsto,
    a.id, a.codigo,
    mr.id, mr.nota_fiscal, mr.serie,
    cp.id, cp.codigo, cp.numeracao_lab,
    cp.idade_dias, cp.idade_unidade,
    cp.data_moldagem, cp.data_prevista_rompimento, cp.data_real_rompimento, cp.situacao,
    cp.material_test_type_id, coalesce(mtt.idade_controle, cfg.idade_controle_default, 28),
    mt.resultado_valor, mt.carga_ruptura_kn, mt.cp_diametro_mm, mt.cp_altura_mm,
    mt.tipo_ruptura, mt.data_rompimento,
    (mt.resultado_valor is not null
       and coalesce(mt.idade_dias, cp.idade_dias) = coalesce(mtt.idade_controle, cfg.idade_controle_default, 28)
       and coalesce(mt.idade_unidade, cp.idade_unidade, 'dia') <> 'hora') as is_controle,
    coalesce(mt.fck_referencia_mpa, c.fck_previsto) as fck_ref,
    case
      when mt.resultado_valor is null then null
      when coalesce(mt.idade_dias, cp.idade_dias) = coalesce(mtt.idade_controle, cfg.idade_controle_default, 28)
           and coalesce(mt.idade_unidade, cp.idade_unidade, 'dia') <> 'hora'
        then (mt.resultado_valor >= coalesce(mt.fck_referencia_mpa, c.fck_previsto))
      else null
    end as conforme
  from public.corpos_prova cp
  join public.concretagens c on c.id = cp.concretagem_id and c.deleted_at is null
  join public.client_works w on w.id = c.work_id
  left join public.amostras a on a.id = cp.amostra_id and a.deleted_at is null
  left join public.material_receipts mr on mr.id = cp.receipt_id
  left join public.material_test_types mtt on mtt.id = cp.material_test_type_id
  left join public.config_lab cfg on cfg.tenant_id = cp.tenant_id
  left join lateral (
    select mt2.* from public.material_tests mt2
    where mt2.corpo_prova_id = cp.id and mt2.deleted_at is null
    order by coalesce(mt2.result_version, 0) desc, mt2.created_at desc
    limit 1
  ) mt on true
  where cp.deleted_at is null and cp.concretagem_id is not null and p_work_ids is not null and c.work_id = any(p_work_ids)
  order by coalesce(c.data_real, c.data_programada) desc nulls last, c.codigo, a.codigo, cp.ordem
  limit 5000;
$$;
