-- Alarme de saude operacional (ops_health) — reaproveitado do GEOCON, adaptado as convencoes do GEOLAB.
-- Monitora o pipeline de notificacoes (notify_event_outbox): backlog preso + dead-letter.
-- Padrao nativo: raise_telemetry_alert (key-first) + resolve escopado por kind + heartbeat.
-- Autocontido: notifica admins dos criticos novos via send-notification (igual a EF), fechando a
-- lacuna de notificacao para este runner. Blindado: erro -> heartbeat 'error', nunca propaga.

-- Setting que faltava (idade minima para considerar um item "preso" na fila).
alter table public.telemetry_settings add column if not exists alert_ops_queue_minutes integer not null default 60;

create or replace function public.telemetry_ops_alarm_run()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.telemetry_settings%rowtype;
  v_active text[] := array[]::text[];
  v_raised int := 0; v_resolved int := 0; v_notified int := 0;
  v_backlog int; v_deadletter int; v_thr int; v_min int;
  v_key text; v_sev text; v_isnew boolean;
  v_secret text; v_url text; v_alert jsonb; r_admin record;
  crit jsonb[] := array[]::jsonb[];
begin
  select * into s from public.telemetry_settings where id = 1;
  if s.id is null or s.alerting_enabled is false or s.alert_ops_enabled is false then
    perform public.record_cron_heartbeat('telemetry-ops-alarm', 90, 'ok', null, 'Ops-health desativado');
    return jsonb_build_object('status','disabled');
  end if;

  -- Check 1: backlog da fila — eventos REALMENTE despachados (mode='sent') que nunca foram processados.
  -- (mode in disabled/dry_run/exception nao conta: nao foram enviados ao notify-event de proposito.)
  v_min := coalesce(s.alert_ops_queue_minutes, 60);
  v_thr := coalesce(s.alert_ops_queue_backlog, 10);
  select count(*) into v_backlog from public.notify_event_outbox
   where processed_at is null and mode = 'sent'
     and created_at < now() - make_interval(mins => v_min);
  if v_backlog >= v_thr then
    v_key := 'ops_health:queue_backlog';
    v_sev := case when v_backlog >= v_thr*2 then 'critical' else 'warning' end;
    select public.raise_telemetry_alert(v_key,'ops_health',v_sev,
      'Fila de notificacoes parada',
      v_backlog||' evento(s) despachado(s) e nao processado(s) ha mais de '||v_min||' min (limiar '||v_thr||'). Verifique a Edge Function notify-event.',
      'queue_backlog', v_backlog, v_thr, null) into v_isnew;
    v_active := array_append(v_active, v_key); v_raised := v_raised + 1;
    if coalesce(v_isnew,false) and v_sev='critical' then
      crit := array_append(crit, jsonb_build_object('key',v_key,'title','Fila de notificacoes parada','detail',v_backlog||' evento(s) parado(s) ha mais de '||v_min||' min.'));
    end if;
  end if;

  -- Check 2: dead-letter — dispatch que terminou em erro (notify_event_dispatch gravou status='error').
  v_thr := greatest(coalesce(s.alert_ops_queue_max_attempts, 5), 1);
  select count(*) into v_deadletter from public.notify_event_outbox
   where status = 'error' and created_at > now() - interval '24 hours';
  if v_deadletter >= 1 then
    v_key := 'ops_health:queue_deadletter';
    v_sev := case when v_deadletter >= v_thr then 'critical' else 'warning' end;
    select public.raise_telemetry_alert(v_key,'ops_health',v_sev,
      'Falhas no dispatch de notificacoes',
      v_deadletter||' evento(s) terminaram em erro nas ultimas 24h (limiar critico '||v_thr||').',
      'queue_deadletter', v_deadletter, v_thr, null) into v_isnew;
    v_active := array_append(v_active, v_key); v_raised := v_raised + 1;
    if coalesce(v_isnew,false) and v_sev='critical' then
      crit := array_append(crit, jsonb_build_object('key',v_key,'title','Falhas no dispatch de notificacoes','detail',v_deadletter||' evento(s) em erro nas ultimas 24h.'));
    end if;
  end if;

  -- Resolve escopado a ops_health (nao toca vitals/cron/pg/email/release).
  update public.telemetry_alert set status='resolved', resolved_at=now()
   where status='open' and kind='ops_health' and not (alert_key = any(v_active));
  get diagnostics v_resolved = row_count;

  -- Notifica admins dos criticos recem-abertos (reusa o unico ponto de saida: send-notification).
  if array_length(crit,1) > 0 then
    select dispatch_secret into v_secret from public.notification_dispatch_settings where id = true;
    v_url := 'https://xbdvyvvxvzmcosnekmfv.supabase.co/functions/v1/send-notification';
    if v_secret is not null and v_secret <> '' then
      foreach v_alert in array crit loop
        for r_admin in select member_id from public.telemetry_admin_member_ids() loop
          perform net.http_post(url := v_url,
            headers := jsonb_build_object('Content-Type','application/json','x-notify-secret', v_secret),
            body := jsonb_build_object(
              'member_id', r_admin.member_id,
              'title','Alerta critico de telemetria (ops): '||(v_alert->>'title'),
              'body', v_alert->>'detail',
              'deep_link','/observabilidade','cta_label','Abrir Observabilidade',
              'event_type','system','entity_type','telemetry_alert','reference', v_alert->>'key',
              'dedupe_key','telemetry_alert:'||(v_alert->>'key')||':'||extract(epoch from now())::bigint||':'||r_admin.member_id),
            timeout_milliseconds := 15000);
          v_notified := v_notified + 1;
        end loop;
      end loop;
    end if;
  end if;

  perform public.record_cron_heartbeat('telemetry-ops-alarm', 90, 'ok', null, 'Saude operacional (fila de notificacoes)');
  return jsonb_build_object('status', case when v_raised>0 then 'warning' else 'ok' end,
                            'raised', v_raised, 'resolved', v_resolved, 'notified', v_notified);
exception when others then
  perform public.record_cron_heartbeat('telemetry-ops-alarm', 90, 'error', sqlerrm, 'Falha no alarme de ops');
  return jsonb_build_object('status','error','error',sqlerrm);
end; $$;
revoke all on function public.telemetry_ops_alarm_run() from public, anon;
grant execute on function public.telemetry_ops_alarm_run() to authenticated, service_role;