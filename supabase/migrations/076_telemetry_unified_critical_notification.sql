-- Notificacao unificada de alertas criticos dos runners SQL (pg/email/release/ops/schedule).
-- A EF telemetry-alarm ja notifica os criticos dos SEUS kinds (error_rate/web_vital/cron/webhook/
-- edge_function) em processo. Os runners SQL so gravavam in-app. Este notificador central cobre
-- exatamente os kinds especializados (mesma particao que o resolve_telemetry_alerts usa),
-- sem sobreposicao com a EF -> nao ha notificacao dupla. notified_at garante 1 e-mail por incidente.

alter table public.telemetry_alert add column if not exists notified_at timestamptz;

create or replace function public.telemetry_notify_pending_alerts()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.telemetry_settings%rowtype;
  v_secret text; v_url text; v_notified int := 0; v_alertas int := 0;
  r record; r_admin record;
begin
  select * into s from public.telemetry_settings where id = 1;
  if s.id is null or s.alerting_enabled is false or s.alert_notify_email is false then
    perform public.record_cron_heartbeat('telemetry-notify', 90, 'ok', null, 'Notificacao por e-mail desativada');
    return jsonb_build_object('status','disabled');
  end if;
  select dispatch_secret into v_secret from public.notification_dispatch_settings where id = true;
  if v_secret is null or v_secret = '' then
    perform public.record_cron_heartbeat('telemetry-notify', 90, 'ok', null, 'Sem dispatch_secret');
    return jsonb_build_object('status','no_secret');
  end if;
  v_url := 'https://xbdvyvvxvzmcosnekmfv.supabase.co/functions/v1/send-notification';

  for r in
    select id, alert_key, kind, title, detail
    from public.telemetry_alert
    where status = 'open' and severity = 'critical' and notified_at is null
      and (kind like 'pg\_%' or kind in ('release_health','email_health','ops_health','schedule_health','frontend_health'))
    order by first_seen_at asc
    limit 50
  loop
    v_alertas := v_alertas + 1;
    for r_admin in select member_id from public.telemetry_admin_member_ids() loop
      perform net.http_post(url := v_url,
        headers := jsonb_build_object('Content-Type','application/json','x-notify-secret', v_secret),
        body := jsonb_build_object(
          'member_id', r_admin.member_id,
          'title','Alerta critico de telemetria: '||r.title,
          'body', r.detail,
          'deep_link','/observabilidade','cta_label','Abrir Observabilidade',
          'event_type','system','entity_type','telemetry_alert','reference', r.alert_key,
          'dedupe_key','telemetry_alert:'||r.alert_key||':'||extract(epoch from now())::bigint||':'||r_admin.member_id),
        timeout_milliseconds := 15000);
      v_notified := v_notified + 1;
    end loop;
    update public.telemetry_alert set notified_at = now() where id = r.id;
  end loop;

  perform public.record_cron_heartbeat('telemetry-notify', 90, 'ok', null, 'Notificacao de criticos dos runners SQL');
  return jsonb_build_object('status','ok','alerts', v_alertas, 'notified', v_notified);
exception when others then
  perform public.record_cron_heartbeat('telemetry-notify', 90, 'error', sqlerrm, 'Falha na notificacao de alertas');
  return jsonb_build_object('status','error','error', sqlerrm);
end; $$;
revoke all on function public.telemetry_notify_pending_alerts() from public, anon;
grant execute on function public.telemetry_notify_pending_alerts() to authenticated, service_role;

-- Ops runner SIMPLIFICADO: remove a notificacao propria (POC). Agora so detecta/resolve/heartbeat;
-- a notificacao de seus criticos passa a ser do notificador central (caminho unico e uniforme).
create or replace function public.telemetry_ops_alarm_run()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.telemetry_settings%rowtype;
  v_active text[] := array[]::text[];
  v_raised int := 0; v_resolved int := 0;
  v_backlog int; v_deadletter int; v_thr int; v_min int;
  v_key text; v_sev text;
begin
  select * into s from public.telemetry_settings where id = 1;
  if s.id is null or s.alerting_enabled is false or s.alert_ops_enabled is false then
    perform public.record_cron_heartbeat('telemetry-ops-alarm', 90, 'ok', null, 'Ops-health desativado');
    return jsonb_build_object('status','disabled');
  end if;

  -- Check 1: backlog da fila (eventos despachados e nunca processados).
  v_min := coalesce(s.alert_ops_queue_minutes, 60);
  v_thr := coalesce(s.alert_ops_queue_backlog, 10);
  select count(*) into v_backlog from public.notify_event_outbox
   where processed_at is null and mode = 'sent'
     and created_at < now() - make_interval(mins => v_min);
  if v_backlog >= v_thr then
    v_key := 'ops_health:queue_backlog';
    v_sev := case when v_backlog >= v_thr*2 then 'critical' else 'warning' end;
    perform public.raise_telemetry_alert(v_key,'ops_health',v_sev,
      'Fila de notificacoes parada',
      v_backlog||' evento(s) despachado(s) e nao processado(s) ha mais de '||v_min||' min (limiar '||v_thr||'). Verifique a Edge Function notify-event.',
      'queue_backlog', v_backlog, v_thr, null);
    v_active := array_append(v_active, v_key); v_raised := v_raised + 1;
  end if;

  -- Check 2: dead-letter (dispatch terminou em erro).
  v_thr := greatest(coalesce(s.alert_ops_queue_max_attempts, 5), 1);
  select count(*) into v_deadletter from public.notify_event_outbox
   where status = 'error' and created_at > now() - interval '24 hours';
  if v_deadletter >= 1 then
    v_key := 'ops_health:queue_deadletter';
    v_sev := case when v_deadletter >= v_thr then 'critical' else 'warning' end;
    perform public.raise_telemetry_alert(v_key,'ops_health',v_sev,
      'Falhas no dispatch de notificacoes',
      v_deadletter||' evento(s) terminaram em erro nas ultimas 24h (limiar critico '||v_thr||').',
      'queue_deadletter', v_deadletter, v_thr, null);
    v_active := array_append(v_active, v_key); v_raised := v_raised + 1;
  end if;

  update public.telemetry_alert set status='resolved', resolved_at=now()
   where status='open' and kind='ops_health' and not (alert_key = any(v_active));
  get diagnostics v_resolved = row_count;

  perform public.record_cron_heartbeat('telemetry-ops-alarm', 90, 'ok', null, 'Saude operacional (fila de notificacoes)');
  return jsonb_build_object('status', case when v_raised>0 then 'warning' else 'ok' end,
                            'raised', v_raised, 'resolved', v_resolved);
exception when others then
  perform public.record_cron_heartbeat('telemetry-ops-alarm', 90, 'error', sqlerrm, 'Falha no alarme de ops');
  return jsonb_build_object('status','error','error',sqlerrm);
end; $$;