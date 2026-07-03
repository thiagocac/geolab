-- 129: fix do guard da 128 — is_tenant_writer no GEOLAB exige o argumento do tenant
-- (assinatura diverge do GEOMAT). Sem ele, a RPC caia no exception handler com
-- "function is_tenant_writer() does not exist" para todo mundo.
-- Aplicada via MCP em xbdvyvvxvzmcosnekmfv (01/07/2026). Registro para o repo.
-- NOTA: o mesmo bug existe LATENTE em set_numeracao_cp (vivo), mascarado pelo fallback de
-- metadata do front (rompimento.ts) — corrigir em migration futura.
-- Corpo = definicao viva (pg_get_functiondef pos-fix); unica mudanca vs 128: is_tenant_writer(v_tenant).

create or replace function public.atribuir_numeracao_cp_lote(p_concretagem_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_tenant uuid := public.current_tenant_id();
  v_ano2 text := to_char(current_date, 'YY');
  v_next int; v_count int := 0; v_ja int := 0;
  v_first text; v_last text; v_num text; r record;
begin
  if v_tenant is null or not public.is_tenant_writer(v_tenant) then
    raise exception 'sem permissao para numerar CPs';
  end if;
  perform 1 from concretagens c where c.id = p_concretagem_id and c.tenant_id = v_tenant and c.deleted_at is null;
  if not found then raise exception 'concretagem nao encontrada'; end if;

  perform pg_advisory_xact_lock(hashtext('cp_numeracao:' || v_tenant::text || ':' || v_ano2));

  select coalesce(max(split_part(numeracao_lab, '/', 1)::int), 0) into v_next
  from corpos_prova
  where tenant_id = v_tenant and deleted_at is null
    and numeracao_lab ~ ('^[0-9]{1,6}/' || v_ano2 || '$');

  select count(*) into v_ja
  from corpos_prova cp
  where cp.concretagem_id = p_concretagem_id and cp.tenant_id = v_tenant
    and cp.deleted_at is null and coalesce(cp.numeracao_lab, '') <> '';

  for r in
    select cp.id
    from corpos_prova cp
    left join amostras a on a.id = cp.amostra_id
    where cp.concretagem_id = p_concretagem_id and cp.tenant_id = v_tenant
      and cp.deleted_at is null and coalesce(cp.numeracao_lab, '') = ''
    order by a.created_at asc nulls last,
             (cp.idade_dias * case when cp.idade_unidade = 'hora' then 1 else 24 end) asc nulls last,
             cp.created_at asc, cp.id
  loop
    v_next := v_next + 1;
    v_num := lpad(v_next::text, greatest(4, length(v_next::text)), '0') || '/' || v_ano2;
    update corpos_prova set numeracao_lab = v_num where id = r.id;
    if v_first is null then v_first := v_num; end if;
    v_last := v_num; v_count := v_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'atribuidos', v_count, 'ja_numerados', v_ja,
                            'primeiro', v_first, 'ultimo', v_last, 'ano', v_ano2);
exception when others then
  return jsonb_build_object('ok', false, 'error', sqlerrm);
end; $function$;
