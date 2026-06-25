-- 049_observabilidade_funcoes.sql — Observabilidade (Camada 2: funções de apoio)
-- Alvo: GEOLAB. Spec: OBSERVABILIDADE.md §V. Depende da 048 (tabelas/índices/RLS).
-- Aditiva e idempotente (CREATE OR REPLACE). Aplicar via MCP. NÃO testável no sandbox (schema vivo).
--
-- Funções (11): app_trace_id, log_ef_invocation, record_cron_heartbeat,
--   bump_client_telemetry_rate_limit, raise_telemetry_alert, resolve_telemetry_alerts,
--   rollup_telemetry_daily (NOVA — autoral; a spec descreve mas não dá o corpo),
--   rollup_telemetry_daily_recent, prune_client_telemetry, frontend_canary_run, telemetry_admin_member_ids.
-- (telemetry_error_fingerprint + trigger já vivem na 048.)
--
-- Adaptações vs spec/doador:
--   * Grants: padrão GEOCON (mais estrito que a spec) → REVOKE EXECUTE FROM public + GRANT TO service_role
--     (as EFs rodam como service_role; cron roda como owner=postgres). app_trace_id também p/ authenticated
--     (chamada por triggers de auditoria no contexto do usuário). Bloqueia anon E authenticated.
--   * frontend_canary_run: URL = https://lab.consultegeo.org/sw.js e regex do CACHE_NAME no formato GEOLAB
--     ('consultegeo-geolab-vNN'), não 'geocon-vNN'.
--   * telemetry_admin_member_ids: members tem role + roles[] + active + deleted_at (confirmado) → verbatim.
--   * O ON CONFLICT de raise_telemetry_alert casa o índice PARCIAL uq_telemetry_alert_open da 048
--     (predicado idêntico WHERE status='open' — evita o erro 42P10 do gotcha de dedupe parcial).

-- ============================================================================
-- V.1 app_trace_id() — trace do header x-trace-id (PostgREST), memoizado na transação.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.app_trace_id()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v text; v_hdr text; v_hdrs text;
BEGIN
  v := nullif(current_setting('app.trace_id', true), '');
  IF v IS NOT NULL THEN RETURN v::uuid; END IF;
  BEGIN
    v_hdrs := current_setting('request.headers', true);
    IF v_hdrs IS NOT NULL AND v_hdrs <> '' THEN
      v_hdr := nullif((v_hdrs::json ->> 'x-trace-id'), '');
      IF v_hdr ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        PERFORM set_config('app.trace_id', v_hdr, true);
        RETURN v_hdr::uuid;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  v := gen_random_uuid()::text;
  PERFORM set_config('app.trace_id', v, true);
  RETURN v::uuid;
END;
$$;

-- ============================================================================
-- V.3 log_ef_invocation() — grava invocação de EF. Param names casam o serveWithTelemetry doador.
--     Descarta OPTIONS (preflight não é invocação — senão v_ef_metrics_hourly infla e gera falso 5xx).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_ef_invocation(
  p_fn_name text, p_started_at timestamptz, p_duration_ms integer, p_status_code integer,
  p_error text, p_actor_id uuid, p_tenant_id uuid, p_request_id text, p_metadata jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF coalesce(p_metadata->>'method', '') = 'OPTIONS' THEN RETURN; END IF;
  INSERT INTO public.ef_invocation_log (
    fn_name, started_at, duration_ms, status_code, error_message,
    actor_id, tenant_id, request_id, metadata
  ) VALUES (
    p_fn_name, p_started_at, GREATEST(COALESCE(p_duration_ms,0),0), COALESCE(p_status_code,0), p_error,
    p_actor_id, p_tenant_id, p_request_id, COALESCE(p_metadata,'{}'::jsonb)
  );
END;
$$;

-- ============================================================================
-- V.4 record_cron_heartbeat() — watchdog upsert (contadores acumulados + falhas consecutivas).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_cron_heartbeat(
  p_job_name text, p_expected_max_age_minutes integer,
  p_status text DEFAULT 'ok', p_error text DEFAULT NULL, p_description text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.cron_heartbeat AS h (
    job_name, expected_max_age_minutes, last_status, last_error,
    consecutive_failures, total_runs, total_failures, description, last_seen_at, updated_at
  ) VALUES (
    p_job_name, p_expected_max_age_minutes, p_status, p_error,
    CASE WHEN p_status IN ('ok','success') THEN 0 ELSE 1 END, 1,
    CASE WHEN p_status IN ('ok','success') THEN 0 ELSE 1 END, p_description, now(), now()
  )
  ON CONFLICT (job_name) DO UPDATE SET
    expected_max_age_minutes = EXCLUDED.expected_max_age_minutes,
    last_status = EXCLUDED.last_status, last_error = EXCLUDED.last_error,
    consecutive_failures = CASE WHEN EXCLUDED.last_status IN ('ok','success') THEN 0 ELSE h.consecutive_failures + 1 END,
    total_runs = h.total_runs + 1,
    total_failures = h.total_failures + CASE WHEN EXCLUDED.last_status IN ('ok','success') THEN 0 ELSE 1 END,
    description = COALESCE(EXCLUDED.description, h.description),
    last_seen_at = now(), updated_at = now();
END;
$$;

-- ============================================================================
-- V.5 bump_client_telemetry_rate_limit() — balde atômico por minuto. Param names casam a EF de ingestão.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.bump_client_telemetry_rate_limit(p_actor_key text, p_bucket_start timestamptz)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_calls int;
BEGIN
  INSERT INTO public.client_telemetry_rate_limit(actor_key, bucket_start, calls)
  VALUES (p_actor_key, p_bucket_start, 1)
  ON CONFLICT (actor_key, bucket_start) DO UPDATE
    SET calls = public.client_telemetry_rate_limit.calls + 1
  RETURNING calls INTO v_calls;
  RETURN v_calls;
END;
$$;

-- ============================================================================
-- V.6 raise_telemetry_alert() / resolve_telemetry_alerts() — ciclo de incidente.
--     raise: upsert idempotente por alert_key; retorna TRUE só quando o incidente é NOVO (gatilho de notificação).
--     resolve: fecha o que não está mais ativo, respeitando o escopo por kind (cada alarme resolve o seu).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.raise_telemetry_alert(
  p_alert_key text, p_kind text, p_severity text, p_title text, p_detail text,
  p_metric text, p_observed numeric, p_threshold numeric, p_app_version text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_existing uuid;
BEGIN
  SELECT id INTO v_existing FROM public.telemetry_alert WHERE alert_key = p_alert_key AND status = 'open' LIMIT 1;
  INSERT INTO public.telemetry_alert AS a (
    alert_key, kind, severity, status, title, detail, metric, observed, threshold, app_version
  ) VALUES (
    p_alert_key, p_kind, COALESCE(NULLIF(p_severity,''),'warning'), 'open',
    p_title, p_detail, p_metric, p_observed, p_threshold, p_app_version
  )
  ON CONFLICT (alert_key) WHERE status = 'open' DO UPDATE
    SET last_seen_at = now(), occurrences = a.occurrences + 1, severity = EXCLUDED.severity,
        detail = EXCLUDED.detail, observed = EXCLUDED.observed, threshold = EXCLUDED.threshold,
        app_version = EXCLUDED.app_version, title = EXCLUDED.title;
  RETURN v_existing IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_telemetry_alerts(p_active_keys text[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_count int;
BEGIN
  UPDATE public.telemetry_alert
     SET status = 'resolved', resolved_at = now()
   WHERE status = 'open'
     AND kind NOT LIKE 'pg\_%'        -- pg_* resolvidos pelo alarme de Postgres
     AND kind <> 'release_health'      -- resolvido pelo alarme de release
     AND kind <> 'email_health'        -- resolvido pelo alarme de e-mail
     AND kind <> 'ops_health'          -- resolvido pelo alarme operacional
     AND kind <> 'schedule_health'     -- resolvido pelo alarme de cronograma
     AND kind <> 'frontend_health'     -- resolvido pelo canário (frontend_canary_run)
     AND NOT (alert_key = ANY (COALESCE(p_active_keys, ARRAY[]::text[])));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================================
-- V.7a rollup_telemetry_daily(date) — AUTORAL (a spec descreve, não codifica).
--     Agrega 1 dia em telemetry_rollup_daily por (day,scope,dim). Idempotente (ON CONFLICT DO UPDATE).
--     scopes: 'client_error' (dim=app_version), 'ef' (dim=fn_name), 'vital' (dim=nome da métrica).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rollup_telemetry_daily(p_day date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_count int := 0; v_n int;
BEGIN
  -- scope 'client_error' por versão
  INSERT INTO public.telemetry_rollup_daily (day, scope, dim, samples, errors, computed_at)
  SELECT p_day, 'client_error', COALESCE(app_version,'?'),
         count(*)::bigint,
         count(*) FILTER (WHERE level IN ('error','fatal'))::bigint,
         now()
    FROM public.client_telemetry_log
   WHERE occurred_at >= p_day::timestamptz AND occurred_at < (p_day + 1)::timestamptz
   GROUP BY COALESCE(app_version,'?')
  ON CONFLICT (day, scope, dim) DO UPDATE
    SET samples = EXCLUDED.samples, errors = EXCLUDED.errors, computed_at = now();
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  -- scope 'ef' por função (p75/p95 de latência, 5xx)
  INSERT INTO public.telemetry_rollup_daily (day, scope, dim, samples, errors_5xx, p75, p95, computed_at)
  SELECT p_day, 'ef', fn_name,
         count(*)::bigint,
         count(*) FILTER (WHERE status_code >= 500)::bigint,
         round(percentile_cont(0.75) WITHIN GROUP (ORDER BY duration_ms)::numeric, 1),
         round(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)::numeric, 1),
         now()
    FROM public.ef_invocation_log
   WHERE started_at >= p_day::timestamptz AND started_at < (p_day + 1)::timestamptz
   GROUP BY fn_name
  ON CONFLICT (day, scope, dim) DO UPDATE
    SET samples = EXCLUDED.samples, errors_5xx = EXCLUDED.errors_5xx,
        p75 = EXCLUDED.p75, p95 = EXCLUDED.p95, computed_at = now();
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  -- scope 'vital' por métrica (p75/p95 + good/needs-improvement/poor)
  INSERT INTO public.telemetry_rollup_daily (day, scope, dim, samples, p75, p95, good, needs_improvement, poor, computed_at)
  SELECT p_day, 'vital', metadata->>'name',
         count(*)::bigint,
         round(percentile_cont(0.75) WITHIN GROUP (ORDER BY (metadata->>'value')::numeric)::numeric, 3),
         round(percentile_cont(0.95) WITHIN GROUP (ORDER BY (metadata->>'value')::numeric)::numeric, 3),
         count(*) FILTER (WHERE metadata->>'rating' = 'good')::bigint,
         count(*) FILTER (WHERE metadata->>'rating' = 'needs-improvement')::bigint,
         count(*) FILTER (WHERE metadata->>'rating' = 'poor')::bigint,
         now()
    FROM public.client_telemetry_log
   WHERE category = 'web-vital'
     AND occurred_at >= p_day::timestamptz AND occurred_at < (p_day + 1)::timestamptz
     AND (metadata->>'value') ~ '^-?\d+(\.\d+)?$'
   GROUP BY metadata->>'name'
  ON CONFLICT (day, scope, dim) DO UPDATE
    SET samples = EXCLUDED.samples, p75 = EXCLUDED.p75, p95 = EXCLUDED.p95,
        good = EXCLUDED.good, needs_improvement = EXCLUDED.needs_improvement, poor = EXCLUDED.poor, computed_at = now();
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  RETURN v_count;
END;
$$;

-- V.7b rollup_telemetry_daily_recent() — recomputa os últimos N dias + heartbeat.
CREATE OR REPLACE FUNCTION public.rollup_telemetry_daily_recent(p_days integer DEFAULT 3)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d date; v_total int := 0;
BEGIN
  FOR d IN SELECT generate_series(current_date - GREATEST(p_days,1) + 1, current_date, interval '1 day')::date LOOP
    v_total := v_total + public.rollup_telemetry_daily(d);
  END LOOP;
  PERFORM public.record_cron_heartbeat('telemetry-rollup', 1500, 'ok', NULL,
    format('Rollup dos últimos %s dia(s); %s linha(s)', GREATEST(p_days,1), v_total));
  RETURN v_total;
END;
$$;

-- ============================================================================
-- V.7c prune_client_telemetry() — retenção: 90d telemetria de cliente, 60d EF, 2d rate-limit.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.prune_client_telemetry()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client int; v_ef int;
BEGIN
  DELETE FROM public.client_telemetry_log       WHERE occurred_at < now() - interval '90 days';
  GET DIAGNOSTICS v_client = ROW_COUNT;
  DELETE FROM public.ef_invocation_log           WHERE started_at  < now() - interval '60 days';
  GET DIAGNOSTICS v_ef = ROW_COUNT;
  DELETE FROM public.client_telemetry_rate_limit WHERE bucket_start < now() - interval '2 days';
  PERFORM public.record_cron_heartbeat('telemetry-prune', 1500, 'ok', NULL,
    format('Retenção: %s telemetria + %s EF-invocações removidas', v_client, v_ef));
END;
$$;

-- ============================================================================
-- V.8 frontend_canary_run() — disponibilidade externa (pg_net GET no sw.js). A cada 15 min.
--     ADAPTADO ao GEOLAB: URL do deploy e regex do CACHE_NAME ('consultegeo-geolab-vNN').
-- ============================================================================
CREATE OR REPLACE FUNCTION public.frontend_canary_run()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_catalog' AS $$
DECLARE
  v_url text := 'https://lab.consultegeo.org/sw.js';
  v_req bigint; v_last record; v_status text := 'ok'; v_err text := null; v_evaluated int := 0;
BEGIN
  -- avalia a resposta da rodada anterior (pareada por request_id do pg_net)
  UPDATE public.frontend_canary_checks c
     SET evaluated_at = now(), status_code = r.status_code,
         ok = (r.status_code = 200 AND r.content LIKE '%CACHE_NAME%' AND NOT COALESCE(r.timed_out,false)),
         cache_name = substring(r.content FROM 'const CACHE_NAME = ''(consultegeo-geolab-v[0-9]+)'''),
         error = CASE WHEN r.status_code = 200 THEN null ELSE COALESCE(r.error_msg, 'http_'||COALESCE(r.status_code::text,'null')) END
    FROM net._http_response r
   WHERE c.evaluated_at IS NULL AND c.request_id = r.id;
  GET DIAGNOSTICS v_evaluated = ROW_COUNT;

  UPDATE public.frontend_canary_checks
     SET evaluated_at = now(), ok = false, error = 'sem_resposta_pg_net'
   WHERE evaluated_at IS NULL AND requested_at < now() - interval '12 minutes';

  SELECT * INTO v_last FROM public.frontend_canary_checks WHERE evaluated_at IS NOT NULL ORDER BY requested_at DESC LIMIT 1;
  IF v_last.id IS NOT NULL THEN
    IF v_last.ok THEN
      UPDATE public.telemetry_alert SET status='resolved', resolved_at=now()
       WHERE alert_key = 'frontend_canary:down' AND status='open';
    ELSE
      PERFORM public.raise_telemetry_alert('frontend_canary:down','frontend_health','critical',
        'Frontend fora do ar (canário sw.js)',
        format('GET %s falhou: %s', v_url, COALESCE(v_last.error,'?')),
        'http_status', COALESCE(v_last.status_code,0), 200, COALESCE(v_last.cache_name,'desconhecida'));
      v_status := 'error'; v_err := COALESCE(v_last.error,'frontend down');
    END IF;
  END IF;

  PERFORM public.record_cron_heartbeat('frontend-canary', 35, v_status, v_err,
    'Canário do frontend: GET /sw.js a cada 15min, extrai CACHE_NAME deployado');
  SELECT net.http_get(v_url) INTO v_req;                                  -- enfileira a próxima sonda
  INSERT INTO public.frontend_canary_checks (request_id, url) VALUES (v_req, v_url);
  DELETE FROM public.frontend_canary_checks WHERE requested_at < now() - interval '30 days';
  RETURN jsonb_build_object('evaluated', v_evaluated, 'last_ok', v_last.ok, 'last_cache_name', v_last.cache_name);
END;
$$;

-- ============================================================================
-- V.9 telemetry_admin_member_ids() — destinatários de notificação (admins do tenant).
--     members do GEOLAB tem role + roles[] (confirmado) → corpo verbatim da spec.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.telemetry_admin_member_ids()
RETURNS TABLE(member_id uuid) LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id FROM public.members
   WHERE active = true AND deleted_at IS NULL
     AND (role = 'admin' OR (roles IS NOT NULL AND 'admin' = ANY (roles)));
$$;

-- ============================================================================
-- Grants — padrão GEOCON: REVOKE de public (bloqueia anon E authenticated) + GRANT a service_role.
--   As EFs (ingestão, serveWithTelemetry, telemetry-alarm) rodam como service_role.
--   O cron roda como owner (postgres), que mantém execute por ser dono.
--   app_trace_id também a authenticated (chamada por triggers de auditoria no contexto do usuário).
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.app_trace_id()                                                     FROM public;
REVOKE EXECUTE ON FUNCTION public.log_ef_invocation(text,timestamptz,integer,integer,text,uuid,uuid,text,jsonb) FROM public;
REVOKE EXECUTE ON FUNCTION public.record_cron_heartbeat(text,integer,text,text,text)                 FROM public;
REVOKE EXECUTE ON FUNCTION public.bump_client_telemetry_rate_limit(text,timestamptz)                 FROM public;
REVOKE EXECUTE ON FUNCTION public.raise_telemetry_alert(text,text,text,text,text,text,numeric,numeric,text) FROM public;
REVOKE EXECUTE ON FUNCTION public.resolve_telemetry_alerts(text[])                                   FROM public;
REVOKE EXECUTE ON FUNCTION public.rollup_telemetry_daily(date)                                       FROM public;
REVOKE EXECUTE ON FUNCTION public.rollup_telemetry_daily_recent(integer)                             FROM public;
REVOKE EXECUTE ON FUNCTION public.prune_client_telemetry()                                           FROM public;
REVOKE EXECUTE ON FUNCTION public.frontend_canary_run()                                              FROM public;
REVOKE EXECUTE ON FUNCTION public.telemetry_admin_member_ids()                                       FROM public;

GRANT EXECUTE ON FUNCTION public.app_trace_id()                                                      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_ef_invocation(text,timestamptz,integer,integer,text,uuid,uuid,text,jsonb)  TO service_role;
GRANT EXECUTE ON FUNCTION public.record_cron_heartbeat(text,integer,text,text,text)                  TO service_role;
GRANT EXECUTE ON FUNCTION public.bump_client_telemetry_rate_limit(text,timestamptz)                  TO service_role;
GRANT EXECUTE ON FUNCTION public.raise_telemetry_alert(text,text,text,text,text,text,numeric,numeric,text)      TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_telemetry_alerts(text[])                                    TO service_role;
GRANT EXECUTE ON FUNCTION public.rollup_telemetry_daily(date)                                        TO service_role;
GRANT EXECUTE ON FUNCTION public.rollup_telemetry_daily_recent(integer)                              TO service_role;
GRANT EXECUTE ON FUNCTION public.prune_client_telemetry()                                            TO service_role;
GRANT EXECUTE ON FUNCTION public.frontend_canary_run()                                               TO service_role;
GRANT EXECUTE ON FUNCTION public.telemetry_admin_member_ids()                                        TO service_role;

-- FIM 049. Próxima: 050_observabilidade_views.sql (9 views genéricas security_invoker=on:
-- v_client_health_by_version, v_release_health, v_client_vitals_daily, v_client_metric_daily,
-- v_ef_metrics_hourly, v_domain_events_daily, v_webhook_dead_letter_alerts,
-- v_telemetry_incident_stats, v_telemetry_mttr_summary, + v_client_error_rate_hourly).
