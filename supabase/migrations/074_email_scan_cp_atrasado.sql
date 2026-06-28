-- Emissor seguro (scan) do evento cp_atrasado — 4º e último evento do catálogo a ganhar emissor.
-- Espelho do resultado<fck. A NC de CP atrasado tem assinatura tipo_code='T-10'
-- (classification_code='CLS-007'), criada por gerar_ncs_cp_atrasado() no cron diário 09:30.
-- SAFE: scan agendado (CP atrasa pela passagem do tempo, não por escrita), idempotente, blindado.
create or replace function public.notify_scan_cp_atrasado(p_lookback_days int default 7)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; v_count int := 0; v_dedupe text;
begin
  for r in
    select nc.id, nc.tenant_id, nc.numero, nc.descricao, nc.data_abertura
    from non_conformities nc
    where nc.tipo_code = 'T-10' and nc.deleted_at is null
      and nc.created_at >= now() - (p_lookback_days || ' days')::interval
  loop
    v_dedupe := 'cp_atrasado:' || r.id::text;
    if exists (select 1 from notification_dispatch_log where dedupe_key = v_dedupe) then continue; end if;
    perform notify_event_dispatch(jsonb_build_object(
      'tenant_id', r.tenant_id, 'event_type', 'cp_atrasado',
      'entity_type', 'non_conformity', 'entity_id', r.id::text, 'dedupe_key', v_dedupe,
      'title', 'Corpo de prova atrasado' || case when r.numero is not null then ' — NC ' || r.numero else '' end,
      'body', coalesce(r.descricao, 'Corpo de prova na idade de controle nao rompido no prazo. Verifique a agenda de rompimento.'),
      'reference', coalesce(r.numero, r.id::text),
      'data', to_char(coalesce(r.data_abertura, current_date), 'DD/MM/YYYY'),
      'deep_link', '/rompimentos'));  -- ROTA: confirmar o caminho da agenda de rompimento
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('ok', true, 'dispatched', v_count, 'lookback_days', p_lookback_days);
exception when others then return jsonb_build_object('ok', false, 'error', sqlerrm); end; $$;
revoke all on function public.notify_scan_cp_atrasado(int) from public, anon;
grant execute on function public.notify_scan_cp_atrasado(int) to authenticated, service_role;