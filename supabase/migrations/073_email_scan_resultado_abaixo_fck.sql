-- Emissor seguro (scan) do evento resultado_abaixo_fck. NÃO usa trigger no caminho crítico de
-- escrita (material_tests/non_conformities) — é scan agendado, idempotente por NC, blindado.
-- A NC de resistência insatisfatória tem assinatura tipo_code='T-02' (create_nc_from_test_result).
create or replace function public.notify_scan_resultado_abaixo_fck(p_lookback_days int default 7)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; v_count int := 0; v_dedupe text;
begin
  for r in
    select nc.id, nc.tenant_id, nc.numero, nc.descricao, nc.data_abertura
    from non_conformities nc
    where nc.tipo_code = 'T-02' and nc.deleted_at is null
      and nc.created_at >= now() - (p_lookback_days || ' days')::interval
  loop
    v_dedupe := 'resultado_abaixo_fck:' || r.id::text;
    if exists (select 1 from notification_dispatch_log where dedupe_key = v_dedupe) then continue; end if;
    perform notify_event_dispatch(jsonb_build_object(
      'tenant_id', r.tenant_id, 'event_type', 'resultado_abaixo_fck',
      'entity_type', 'non_conformity', 'entity_id', r.id::text, 'dedupe_key', v_dedupe,
      'title', 'Resultado abaixo do fck' || case when r.numero is not null then ' — NC ' || r.numero else '' end,
      'body', coalesce(r.descricao, 'Resultado abaixo do FCK de referencia na idade de controle. Verifique a nao conformidade.'),
      'reference', coalesce(r.numero, r.id::text),
      'data', to_char(coalesce(r.data_abertura, current_date), 'DD/MM/YYYY'),
      'deep_link', '/nao-conformidades'));
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('ok', true, 'dispatched', v_count, 'lookback_days', p_lookback_days);
exception when others then return jsonb_build_object('ok', false, 'error', sqlerrm); end; $$;
revoke all on function public.notify_scan_resultado_abaixo_fck(int) from public, anon;
grant execute on function public.notify_scan_resultado_abaixo_fck(int) to authenticated, service_role;