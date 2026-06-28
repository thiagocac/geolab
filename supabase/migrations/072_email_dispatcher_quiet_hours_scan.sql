-- Trilha de e-mail: dispatcher SQL + quiet hours + scan de calibração. Aditivo e idempotente.
-- Tudo blindado (EXCEPTION WHEN OTHERS) — emissão NUNCA aborta transação de negócio (playbook §1.6).

-- 1) Dispatcher: grava o outbox SEMPRE e (se ligado) faz net.http_post p/ notify-event (que faz o fan-out).
create or replace function public.notify_event_dispatch(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_enabled boolean; v_dry boolean; v_secret text; v_url text;
  v_tenant uuid; v_event text; v_mode text; v_outbox uuid; v_trace text;
begin
  v_tenant := nullif(p_payload->>'tenant_id','')::uuid;
  v_event  := coalesce(nullif(p_payload->>'event_type',''), 'system.event');
  v_trace  := coalesce(nullif(p_payload->>'trace_id',''), gen_random_uuid()::text);

  select dispatch_enabled, dry_run, dispatch_secret,
         coalesce(nullif(notify_event_url,''), 'https://xbdvyvvxvzmcosnekmfv.supabase.co/functions/v1/notify-event')
    into v_enabled, v_dry, v_secret, v_url
  from notification_dispatch_settings where id = true;

  v_mode := case
    when v_secret is null or v_secret = '' then 'error_no_secret'
    when coalesce(v_enabled,false) = false then 'disabled'
    when coalesce(v_dry,true) = true        then 'dry_run'
    else 'sent' end;

  insert into notify_event_outbox (tenant_id, event_type, payload, mode, status, trace_id)
  values (v_tenant, v_event, p_payload, v_mode, 'pending', v_trace)
  returning id into v_outbox;

  if v_mode = 'sent' then
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type','application/json','x-notify-secret', v_secret),
      body := p_payload || jsonb_build_object('outbox_id', v_outbox, 'trace_id', v_trace),
      timeout_milliseconds := 20000);
  end if;

  return jsonb_build_object('ok', true, 'mode', v_mode, 'outbox_id', v_outbox, 'event_type', v_event);
exception when others then
  begin
    insert into notify_event_outbox (tenant_id, event_type, payload, mode, status, last_error, trace_id)
    values (v_tenant, v_event, p_payload, 'exception', 'error', sqlerrm, v_trace);
  exception when others then null; end;
  return jsonb_build_object('ok', false, 'mode', 'exception', 'error', sqlerrm);
end; $$;
revoke all on function public.notify_event_dispatch(jsonb) from public, anon;
grant execute on function public.notify_event_dispatch(jsonb) to authenticated, service_role;

-- 2) Quiet hours: true só fora do horário e p/ evento NÃO-system. Fail-open (erro -> false, deixa enviar).
create or replace function public.is_in_quiet_hours(p_member_id uuid, p_event_type text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_is_system boolean; v_start time; v_end time; v_tz text; v_now time;
begin
  select is_system into v_is_system from notification_event_types where key = p_event_type;
  if coalesce(v_is_system, false) then return false; end if;  -- system fura quiet hours

  select quiet_hours_start, quiet_hours_end, coalesce(nullif(timezone,''),'America/Sao_Paulo')
    into v_start, v_end, v_tz
  from member_notification_prefs
  where member_id = p_member_id and quiet_hours_start is not null and quiet_hours_end is not null
  order by (event_type = p_event_type) desc nulls last
  limit 1;

  if v_start is null or v_end is null then return false; end if;
  v_now := (now() at time zone v_tz)::time;
  if v_start <= v_end then return v_now >= v_start and v_now < v_end;     -- janela no mesmo dia
  else                     return v_now >= v_start or  v_now < v_end; end if; -- janela atravessa meia-noite
exception when others then return false; end; $$;
revoke all on function public.is_in_quiet_hours(uuid, text) from public, anon;
grant execute on function public.is_in_quiet_hours(uuid, text) to authenticated, service_role;

-- 3) Scan de calibração: dispara 'calibracao_vencendo' p/ equipamentos vencendo em p_days dias.
--    Idempotente por (equipamento, validade) — não reenvia. SAFE: é scan agendado, não toca write de negócio.
create or replace function public.notify_scan_calibracao(p_days int default 30)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; v_count int := 0; v_dedupe text;
begin
  for r in
    select e.id, e.tenant_id, e.tipo, e.marca_modelo, e.numero_serie, e.validade_calibracao,
           (e.validade_calibracao - current_date) as dias
    from equipamentos e
    where e.ativo = true and e.deleted_at is null and e.validade_calibracao is not null
      and e.validade_calibracao >= current_date
      and e.validade_calibracao <= current_date + (p_days || ' days')::interval
  loop
    v_dedupe := 'calibracao_vencendo:' || r.id::text || ':' || r.validade_calibracao::text;
    if exists (select 1 from notification_dispatch_log where dedupe_key = v_dedupe) then continue; end if;
    perform notify_event_dispatch(jsonb_build_object(
      'tenant_id', r.tenant_id, 'event_type', 'calibracao_vencendo',
      'entity_type', 'equipamento', 'entity_id', r.id::text, 'dedupe_key', v_dedupe,
      'title', 'Calibracao vencendo: ' || coalesce(r.tipo,'equipamento') || ' ' || coalesce(r.marca_modelo,''),
      'body', 'A calibracao do equipamento ' || coalesce(r.tipo,'') || ' ' || coalesce(r.marca_modelo,'') ||
              ' (serie ' || coalesce(r.numero_serie,'-') || ') vence em ' || to_char(r.validade_calibracao,'DD/MM/YYYY') ||
              ' (em ' || r.dias || ' dias).',
      'reference', coalesce(r.numero_serie, r.id::text), 'data', to_char(r.validade_calibracao,'DD/MM/YYYY'),
      'deep_link', '/equipamentos'));
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('ok', true, 'dispatched', v_count, 'window_days', p_days);
exception when others then return jsonb_build_object('ok', false, 'error', sqlerrm); end; $$;
revoke all on function public.notify_scan_calibracao(int) from public, anon;
grant execute on function public.notify_scan_calibracao(int) to authenticated, service_role;