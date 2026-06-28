-- 081 — notify_scan_calibracao passa a cobrir também calibrações JÁ VENCIDAS
-- ===========================================================================
-- Fecha o gap de cobertura aberto pela 080 (aposentadoria do cron-watchdog): o
-- watchdog alertava equipamentos com calibração já vencida (validade < hoje), o
-- que o scan não fazia (exigia validade >= hoje). Aqui removemos o piso de data
-- e o scan passa a varrer validade <= hoje + p_days (inclui vencidas).
--
--   • dedupe_key INALTERADA ('calibracao_vencendo:<id>:<validade>') => uma única
--     notificação por (equipamento, validade); nada de spam recorrente.
--   • Texto adaptado: "venceu em DD/MM (ha N dias)" para vencidas vs
--     "vence em DD/MM (em N dias)" para a vencer; título "Calibracao vencida/vencendo".
--   • Mantém event_type 'calibracao_vencendo', SECURITY DEFINER e search_path.
--
-- Verificado antes de aplicar: 0 equipamentos ativos vencidos no momento => sem
-- rajada de e-mails no próximo run das 12:00.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.notify_scan_calibracao(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; v_count int := 0; v_dedupe text; v_venc boolean; v_abs int;
begin
  for r in
    select e.id, e.tenant_id, e.tipo, e.marca_modelo, e.numero_serie, e.validade_calibracao,
           (e.validade_calibracao - current_date) as dias
    from equipamentos e
    where e.ativo = true and e.deleted_at is null and e.validade_calibracao is not null
      and e.validade_calibracao <= current_date + (p_days || ' days')::interval
  loop
    v_dedupe := 'calibracao_vencendo:' || r.id::text || ':' || r.validade_calibracao::text;
    if exists (select 1 from notification_dispatch_log where dedupe_key = v_dedupe) then continue; end if;
    v_venc := r.dias < 0;
    v_abs  := abs(r.dias);
    perform notify_event_dispatch(jsonb_build_object(
      'tenant_id', r.tenant_id, 'event_type', 'calibracao_vencendo',
      'entity_type', 'equipamento', 'entity_id', r.id::text, 'dedupe_key', v_dedupe,
      'title', case when v_venc then 'Calibracao vencida: ' else 'Calibracao vencendo: ' end
               || coalesce(r.tipo,'equipamento') || ' ' || coalesce(r.marca_modelo,''),
      'body', 'A calibracao do equipamento ' || coalesce(r.tipo,'') || ' ' || coalesce(r.marca_modelo,'') ||
              ' (serie ' || coalesce(r.numero_serie,'-') || ') ' ||
              case when v_venc
                   then 'venceu em ' || to_char(r.validade_calibracao,'DD/MM/YYYY') || ' (ha ' || v_abs || ' dias).'
                   else 'vence em ' || to_char(r.validade_calibracao,'DD/MM/YYYY') || ' (em ' || r.dias || ' dias).' end,
      'reference', coalesce(r.numero_serie, r.id::text), 'data', to_char(r.validade_calibracao,'DD/MM/YYYY'),
      'deep_link', '/equipamentos'));
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('ok', true, 'dispatched', v_count, 'window_days', p_days);
exception when others then return jsonb_build_object('ok', false, 'error', sqlerrm); end; $function$;
