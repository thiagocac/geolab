-- 139_central_status_tecnico_cancelada (APLICADA 02/07/2026 via MCP) — registro fiel.
-- Status técnico da Central distingue programação CANCELADA (única mudança vs 088 = 1º branch do CASE).
create or replace function public.concretagens_central_paged(p_tenant uuid, p_client uuid default null::uuid, p_work uuid default null::uuid, p_status text default null::text, p_search text default null::text, p_from date default null::date, p_to date default null::date, p_limit integer default 25, p_offset integer default 0)
returns table(id uuid, codigo text, numero_relatorio text, status text, status_tecnico text, origem text, data_programada date, data_real date, fornecedor_texto text, fck_previsto numeric, cliente text, obra text, n_caminhoes integer, n_cps integer, n_cps_rompidos integer, n_cps_atrasados integer, n_laudos integer, total_count bigint)
language sql
stable security definer
set search_path to 'public'
as $function$
  with base as (
    select
      c.id,
      c.codigo::text as codigo,
      c.numero_relatorio::text as numero_relatorio,
      c.status::text as status,
      c.origem::text as origem,
      c.data_programada,
      c.data_real,
      c.fornecedor_texto::text as fornecedor_texto,
      c.fck_previsto::numeric as fck_previsto,
      c.client_id, c.work_id,
      lc.razao_social::text as cliente,
      cw.nome::text as obra,
      count(distinct mr.id) as n_caminhoes,
      count(distinct cp.id) as n_cps,
      count(distinct cp.id) filter (where cp.situacao = 'rompido') as n_cps_rompidos,
      count(distinct cp.id) filter (where cp.situacao = 'pendente' and cp.data_prevista_rompimento < current_date) as n_cps_atrasados,
      count(distinct lr.id) as n_laudos,
      case
        when c.status = 'cancelada' then 'cancelada'
        when count(distinct lr.id) filter (where lr.status = 'emitido') > 0 then 'laudado'
        when count(distinct cp.id) filter (where cp.situacao = 'pendente' and cp.data_prevista_rompimento < current_date) > 0 then 'atrasado'
        when count(distinct cp.id) > 0 and count(distinct cp.id) filter (where cp.situacao = 'rompido') = count(distinct cp.id) then 'rompido'
        when count(distinct cp.id) > 0 then 'em_andamento'
        when count(distinct mr.id) > 0 then 'moldado'
        else 'programado'
      end as status_tecnico
    from concretagens c
    left join lab_clients lc on lc.id = c.client_id
    left join client_works cw on cw.id = c.work_id
    left join material_receipts mr on mr.concretagem_id = c.id and mr.deleted_at is null
    left join corpos_prova cp on cp.concretagem_id = c.id and cp.deleted_at is null
    left join lab_reports lr on lr.concretagem_id = c.id and lr.deleted_at is null
    where c.deleted_at is null
      and c.tenant_id = p_tenant and is_tenant_member(p_tenant)
      and (p_client is null or c.client_id = p_client)
      and (p_work is null or c.work_id = p_work)
      and (p_from is null or coalesce(c.data_programada, c.data_real) >= p_from)
      and (p_to is null or coalesce(c.data_programada, c.data_real) <= p_to)
      and (
        p_search is null or p_search = '' or
        c.numero_relatorio ilike '%' || p_search || '%' or
        c.codigo ilike '%' || p_search || '%' or
        c.fornecedor_texto ilike '%' || p_search || '%'
      )
    group by c.id, lc.razao_social, cw.nome
  ), filt as (
    select * from base
    where (p_status is null or p_status = '' or p_status = 'all' or status_tecnico = p_status)
  )
  select
    id, codigo, numero_relatorio, status, status_tecnico, origem, data_programada, data_real,
    fornecedor_texto, fck_previsto, cliente, obra,
    n_caminhoes::int, n_cps::int, n_cps_rompidos::int, n_cps_atrasados::int, n_laudos::int,
    count(*) over()::bigint as total_count
  from filt
  order by coalesce(data_programada, data_real) desc nulls last, codigo desc
  limit greatest(coalesce(p_limit, 25), 1)
  offset greatest(coalesce(p_offset, 0), 0)
$function$;
