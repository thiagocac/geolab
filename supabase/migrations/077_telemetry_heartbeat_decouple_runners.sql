-- Desacopla o heartbeat de "achou alerta": o heartbeat passa a refletir EXECUCAO do job
-- ('ok' se rodou; 'error' so em falha de execucao). As descobertas seguem 100% no telemetry_alert
-- (e agora notificadas pelo notificador central). Evita inflar consecutive_failures e o cascata
-- de cron:<job> critico. Unica alteracao em cada runner: a chamada de record_cron_heartbeat do
-- caminho de sucesso (warning-quando-raised -> 'ok'). Todo o resto e' identico ao vivo.

-- ===== pg =====
create or replace function public.telemetry_pg_alarm_run()
returns jsonb language plpgsql security definer set search_path to 'public','extensions','pg_catalog'
as $function$
DECLARE
  s public.telemetry_settings%rowtype;
  v_active text[] := array[]::text[]; v_raised int := 0; v_resolved int := 0;
  r record; v_key text; v_sev text;
BEGIN
  SELECT * INTO s FROM public.telemetry_settings WHERE id = 1;
  IF s.id IS NULL OR s.alerting_enabled IS FALSE OR s.alert_pg_enabled IS FALSE THEN
    PERFORM public.record_cron_heartbeat('telemetry-pg-alarm', 120, 'ok', NULL, 'DB-health desativado');
    RETURN jsonb_build_object('status','disabled');
  END IF;
  BEGIN
    FOR r IN
      SELECT st.queryid, left(regexp_replace(st.query,'\s+',' ','g'),200) AS q,
             st.calls, round(st.mean_exec_time::numeric,1) AS mean_ms
      FROM extensions.pg_stat_statements st
      WHERE st.calls >= s.alert_pg_min_calls
        AND st.mean_exec_time >= s.alert_pg_mean_ms
        AND st.query !~* '^(SET|SHOW|BEGIN|COMMIT|ROLLBACK|DEALLOCATE|RESET|DISCARD|ANALYZE|VACUUM)'
        AND st.query !~* 'pg_sleep'
        AND st.query !~* 'pg_stat_statements'
        AND st.query !~* 'net\._http_response|cron\.job|telemetry_pg_alarm'
      ORDER BY st.mean_exec_time DESC LIMIT 20
    LOOP
      v_key := 'pg_query:' || r.queryid;
      v_sev := CASE WHEN r.mean_ms >= s.alert_pg_mean_ms * 2 THEN 'critical' ELSE 'warning' END;
      PERFORM public.raise_telemetry_alert(v_key, 'pg_query', v_sev,
        'Query lenta e frequente (media ' || r.mean_ms || ' ms)',
        r.calls || ' chamadas, media ' || r.mean_ms || ' ms (limiar ' || s.alert_pg_mean_ms ||
          ' ms / ' || s.alert_pg_min_calls || ' calls). ' || r.q,
        'mean_ms', r.mean_ms, s.alert_pg_mean_ms, NULL);
      v_active := array_append(v_active, v_key); v_raised := v_raised + 1;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  FOR r IN
    SELECT t.relname AS tbl,
           round(100.0 * t.n_dead_tup / nullif(t.n_live_tup + t.n_dead_tup,0),1) AS dead_pct,
           pg_size_pretty(pg_total_relation_size(c.oid)) AS sz, t.n_dead_tup
    FROM pg_catalog.pg_stat_user_tables t
    JOIN pg_catalog.pg_class c ON c.oid = t.relid
    WHERE pg_total_relation_size(c.oid) >= s.alert_pg_min_table_bytes
      AND (t.n_live_tup + t.n_dead_tup) > 0
      AND round(100.0 * t.n_dead_tup / nullif(t.n_live_tup + t.n_dead_tup,0),1) >= s.alert_pg_dead_pct
    ORDER BY t.n_dead_tup DESC LIMIT 20
  LOOP
    v_key := 'pg_table:' || r.tbl;
    v_sev := CASE WHEN r.dead_pct >= s.alert_pg_dead_pct * 2 THEN 'critical' ELSE 'warning' END;
    PERFORM public.raise_telemetry_alert(v_key, 'pg_table', v_sev,
      'Tabela inchada: ' || r.tbl || ' (' || r.dead_pct || '% tuplas mortas)',
      r.n_dead_tup || ' tuplas mortas (' || r.dead_pct || '%) em ' || r.sz ||
        ' — limiar ' || s.alert_pg_dead_pct || '%. Considere VACUUM/autovacuum tuning.',
      'dead_pct', r.dead_pct, s.alert_pg_dead_pct, NULL);
    v_active := array_append(v_active, v_key); v_raised := v_raised + 1;
  END LOOP;
  UPDATE public.telemetry_alert SET status='resolved', resolved_at=now()
   WHERE status='open' AND kind LIKE 'pg\_%' AND NOT (alert_key = ANY (v_active));
  GET DIAGNOSTICS v_resolved = ROW_COUNT;
  PERFORM public.record_cron_heartbeat('telemetry-pg-alarm', 120, 'ok', NULL,
    'Saude do Postgres (queries lentas, bloat)');
  RETURN jsonb_build_object('status', CASE WHEN v_raised>0 THEN 'warning' ELSE 'ok' END,
    'raised', v_raised, 'resolved', v_resolved);
END;
$function$;

-- ===== email =====
create or replace function public.telemetry_email_alarm_run()
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
DECLARE
  s public.telemetry_settings%rowtype;
  v_active text[] := array[]::text[]; v_raised int := 0; v_resolved int := 0;
  v_attempted int; v_bounced int; v_complained int;
  v_bounce_pct numeric := 0; v_complaint_pct numeric := 0; v_sev text;
BEGIN
  SELECT * INTO s FROM public.telemetry_settings WHERE id = 1;
  IF s.id IS NULL OR s.alerting_enabled IS FALSE OR s.alert_email_enabled IS FALSE THEN
    PERFORM public.record_cron_heartbeat('telemetry-email-alarm', 120, 'ok', NULL, 'Alarme de e-mail desativado');
    RETURN jsonb_build_object('status','disabled');
  END IF;
  SELECT count(*) FILTER (WHERE resend_id IS NOT NULL),
         count(*) FILTER (WHERE bounced_at IS NOT NULL OR status = 'bounced'),
         count(*) FILTER (WHERE complained_at IS NOT NULL OR status = 'complained')
    INTO v_attempted, v_bounced, v_complained
  FROM public.notification_dispatch_log
  WHERE deleted_at IS NULL AND created_at > now() - make_interval(hours => s.alert_email_window_hours);
  IF v_attempted >= s.alert_email_min_sent THEN
    v_bounce_pct := round(100.0 * v_bounced / v_attempted, 2);
    v_complaint_pct := round(100.0 * v_complained / v_attempted, 2);
    IF v_bounce_pct >= s.alert_email_bounce_pct THEN
      v_sev := CASE WHEN v_bounce_pct >= s.alert_email_bounce_pct * 2 THEN 'critical' ELSE 'warning' END;
      PERFORM public.raise_telemetry_alert('email_health:bounce', 'email_health', v_sev,
        'Taxa de bounce alta (' || v_bounce_pct || '%)',
        v_bounced || ' bounce(s) em ' || v_attempted || ' envios nas ultimas ' || s.alert_email_window_hours ||
          'h (limiar ' || s.alert_email_bounce_pct || '%). Reputacao de remetente em risco.',
        'bounce_pct', v_bounce_pct, s.alert_email_bounce_pct, NULL);
      v_active := array_append(v_active, 'email_health:bounce'); v_raised := v_raised + 1;
    END IF;
    IF v_complaint_pct >= s.alert_email_complaint_pct THEN
      v_sev := CASE WHEN v_complaint_pct >= s.alert_email_complaint_pct * 2 THEN 'critical' ELSE 'warning' END;
      PERFORM public.raise_telemetry_alert('email_health:complaint', 'email_health', v_sev,
        'Taxa de reclamacao alta (' || v_complaint_pct || '%)',
        v_complained || ' reclamacao(oes) em ' || v_attempted || ' envios nas ultimas ' || s.alert_email_window_hours ||
          'h (limiar ' || s.alert_email_complaint_pct || '%). Risco de bloqueio pelo provedor.',
        'complaint_pct', v_complaint_pct, s.alert_email_complaint_pct, NULL);
      v_active := array_append(v_active, 'email_health:complaint'); v_raised := v_raised + 1;
    END IF;
  END IF;
  UPDATE public.telemetry_alert SET status = 'resolved', resolved_at = now()
   WHERE status = 'open' AND kind = 'email_health' AND NOT (alert_key = ANY (v_active));
  GET DIAGNOSTICS v_resolved = ROW_COUNT;
  PERFORM public.record_cron_heartbeat('telemetry-email-alarm', 120, 'ok', NULL,
    'Bounce/complaint rate do Resend (janela ' || s.alert_email_window_hours || 'h)');
  RETURN jsonb_build_object('status', CASE WHEN v_raised>0 THEN 'warning' ELSE 'ok' END,
    'raised', v_raised, 'resolved', v_resolved, 'attempted', v_attempted,
    'bounce_pct', v_bounce_pct, 'complaint_pct', v_complaint_pct);
END;
$function$;

-- ===== release =====
create or replace function public.telemetry_release_alarm_run()
returns jsonb language plpgsql security definer set search_path to 'public','pg_catalog'
as $function$
DECLARE
  s public.telemetry_settings%rowtype; v_active text[] := array[]::text[];
  v_raised int := 0; v_resolved int := 0; v_win interval := interval '24 hours';
  cur record; prev_cf numeric; v_key text; v_sev text;
BEGIN
  SELECT * INTO s FROM public.telemetry_settings WHERE id = 1;
  IF s.id IS NULL OR s.alerting_enabled IS FALSE OR s.alert_crash_free_enabled IS FALSE THEN
    UPDATE public.telemetry_alert SET status='resolved', resolved_at=now()
      WHERE status='open' AND kind='release_health';
    GET DIAGNOSTICS v_resolved = ROW_COUNT;
    PERFORM public.record_cron_heartbeat('telemetry-release-alarm', 120, 'ok', NULL, 'Crash-free por release desativado');
    RETURN jsonb_build_object('status','disabled','resolved',v_resolved);
  END IF;
  SELECT app_version,
         count(DISTINCT session_id) AS sessions,
         count(DISTINCT session_id) FILTER (WHERE level IN ('error','fatal')) AS err_sessions,
         round(100.0 * (count(DISTINCT session_id) - count(DISTINCT session_id) FILTER (WHERE level IN ('error','fatal')))::numeric
               / nullif(count(DISTINCT session_id),0), 2) AS crash_free
    INTO cur
  FROM public.client_telemetry_log
  WHERE occurred_at > now() - v_win AND app_version IS NOT NULL
  GROUP BY app_version
  HAVING count(DISTINCT session_id) >= s.alert_release_min_sessions
  ORDER BY max(occurred_at) DESC LIMIT 1;
  IF cur.app_version IS NOT NULL AND cur.crash_free < s.alert_crash_free_min_pct THEN
    SELECT round(100.0 * (count(DISTINCT session_id) - count(DISTINCT session_id) FILTER (WHERE level IN ('error','fatal')))::numeric
                 / nullif(count(DISTINCT session_id),0), 2) INTO prev_cf
    FROM public.client_telemetry_log
    WHERE occurred_at > now() - (v_win * 3) AND app_version IS NOT NULL AND app_version <> cur.app_version;
    v_key := 'release_health:' || cur.app_version;
    v_sev := CASE WHEN cur.crash_free < (s.alert_crash_free_min_pct - 10) THEN 'critical' ELSE 'warning' END;
    PERFORM public.raise_telemetry_alert(v_key, 'release_health', v_sev,
      'Crash-free baixo na release ' || cur.app_version || ' (' || cur.crash_free || '%)',
      cur.err_sessions || ' de ' || cur.sessions || ' sessoes com erro nas ultimas 24h (crash-free ' ||
        cur.crash_free || '%, limiar ' || s.alert_crash_free_min_pct || '%).' ||
        coalesce(' Versoes anteriores: ' || prev_cf || '%.', ''),
      'crash_free_pct', cur.crash_free, s.alert_crash_free_min_pct, cur.app_version);
    v_active := array_append(v_active, v_key); v_raised := 1;
  END IF;
  UPDATE public.telemetry_alert SET status='resolved', resolved_at=now()
    WHERE status='open' AND kind='release_health' AND NOT (alert_key = ANY (v_active));
  GET DIAGNOSTICS v_resolved = ROW_COUNT;
  PERFORM public.record_cron_heartbeat('telemetry-release-alarm', 120, 'ok', NULL,
    'Crash-free por release (regressao pos-deploy)');
  RETURN jsonb_build_object('status', CASE WHEN v_raised>0 THEN 'warning' ELSE 'ok' END,
    'raised', v_raised, 'resolved', v_resolved, 'version', cur.app_version, 'crash_free', cur.crash_free);
END;
$function$;