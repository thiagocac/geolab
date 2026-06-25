-- 050_observabilidade_views.sql — Observabilidade (Camada 3: views de saúde)
-- Alvo: GEOLAB. Spec: OBSERVABILIDADE.md §VI. Depende de 048 (tabelas) e 049 (telemetry_settings p/ HAVING).
-- Aditiva e idempotente (CREATE OR REPLACE VIEW). Aplicar via MCP. NÃO testável no sandbox.
--
-- 9 views genéricas. Consumidas pelo alarme (service_role, ignora RLS) e pelo painel admin.
--
-- Adaptações vs spec/doador:
--   * TODA view com WITH (security_invoker = on) — invariante GEOLAB que o check-source cobra.
--     Efeito: a view roda com o privilégio/RLS de quem consulta. Como as tabelas-base são admin-only
--     por RLS (048), admin vê tudo; authenticated comum vê vazio; service_role (alarme) ignora RLS.
--   * v_webhook_dead_letter_alerts: o GEOLAB NÃO tem webhook_event_queue (GeoCon). Apontada para o
--     análogo real do GEOLAB: notify_event_outbox (enqueued_at→created_at, event→event_type). Mesmos
--     nomes de coluna de saída para o alarme (Camada 7) ler sem mudança.
--   * Tabelas-base schema-qualificadas (public.*) para evitar ambiguidade de search_path na criação.
--   * Vocabulário casa a 048: occurred_at|level|category|message|metadata->>'value'/'rating'.
--
-- NÃO inclusas (VI.6 — views de domínio, específicas do produto, fase 2): equivalentes GEOLAB a
--   v_report_generation_health, v_*_funnel etc. exigem decisão de domínio (laudo/rompimento/concretagem).

-- ============================================================================
-- VI.1 RUM por versão (7d) e release health / crash-free (30d)
-- ============================================================================
CREATE OR REPLACE VIEW public.v_client_health_by_version
WITH (security_invoker = on) AS
 SELECT tenant_id, COALESCE(app_version,'—') AS app_version,
    count(*) AS events,
    count(*) FILTER (WHERE level = ANY (ARRAY['error','fatal'])) AS errors,
    count(*) FILTER (WHERE level = 'warn') AS warnings,
    count(DISTINCT session_id) AS sessions,
    round(100.0 * count(*) FILTER (WHERE level = ANY (ARRAY['error','fatal']))::numeric
          / NULLIF(count(*),0)::numeric, 2) AS error_rate_pct,
    max(occurred_at) AS last_seen
   FROM public.client_telemetry_log
  WHERE occurred_at > now() - interval '7 days'
  GROUP BY tenant_id, COALESCE(app_version,'—');

CREATE OR REPLACE VIEW public.v_release_health
WITH (security_invoker = on) AS
 SELECT tenant_id, COALESCE(app_version,'—') AS app_version,
    count(*) AS events,
    count(*) FILTER (WHERE level = ANY (ARRAY['error','fatal'])) AS errors,
    count(DISTINCT session_id) AS sessions,
    count(DISTINCT session_id) FILTER (WHERE level = ANY (ARRAY['error','fatal'])) AS error_sessions,
    round(100.0 * (count(DISTINCT session_id) - count(DISTINCT session_id) FILTER (WHERE level = ANY (ARRAY['error','fatal'])))::numeric
          / NULLIF(count(DISTINCT session_id),0)::numeric, 2) AS crash_free_sessions_pct,
    count(DISTINCT member_id) FILTER (WHERE member_id IS NOT NULL) AS users,
    count(DISTINCT member_id) FILTER (WHERE level = ANY (ARRAY['error','fatal']) AND member_id IS NOT NULL) AS error_users,
    round(100.0 * (count(DISTINCT member_id) FILTER (WHERE member_id IS NOT NULL) - count(DISTINCT member_id) FILTER (WHERE level = ANY (ARRAY['error','fatal']) AND member_id IS NOT NULL))::numeric
          / NULLIF(count(DISTINCT member_id) FILTER (WHERE member_id IS NOT NULL),0)::numeric, 2) AS crash_free_users_pct,
    round(100.0 * count(*) FILTER (WHERE level = ANY (ARRAY['error','fatal']))::numeric / NULLIF(count(*),0)::numeric, 2) AS error_rate_pct,
    min(occurred_at) AS first_seen, max(occurred_at) AS last_seen
   FROM public.client_telemetry_log
  WHERE occurred_at > now() - interval '30 days'
  GROUP BY tenant_id, COALESCE(app_version,'—');

-- ============================================================================
-- VI.2 Web Vitals e métricas — percentis a partir do JSONB (com piso de amostras).
--      Filtro numérico em metadata->>'value' (armadilha #5: percentil sobre JSONB).
-- ============================================================================
CREATE OR REPLACE VIEW public.v_client_vitals_daily
WITH (security_invoker = on) AS
 SELECT tenant_id, date_trunc('day', occurred_at) AS day,
    metadata ->> 'name' AS metric, count(*) AS samples,
    round(percentile_cont(0.75) WITHIN GROUP (ORDER BY ((metadata->>'value')::numeric)::double precision)::numeric, 3) AS p75,
    round(percentile_cont(0.95) WITHIN GROUP (ORDER BY ((metadata->>'value')::numeric)::double precision)::numeric, 3) AS p95,
    count(*) FILTER (WHERE metadata->>'rating' = 'good') AS good,
    count(*) FILTER (WHERE metadata->>'rating' = 'needs-improvement') AS needs_improvement,
    count(*) FILTER (WHERE metadata->>'rating' = 'poor') AS poor
   FROM public.client_telemetry_log
  WHERE category = 'web-vital' AND (metadata->>'value') ~ '^-?\d+(\.\d+)?$'
  GROUP BY tenant_id, date_trunc('day', occurred_at), metadata ->> 'name'
 HAVING count(*) >= (SELECT alert_vital_min_samples FROM public.telemetry_settings WHERE id = 1);

CREATE OR REPLACE VIEW public.v_client_metric_daily
WITH (security_invoker = on) AS
 SELECT tenant_id, date_trunc('day', occurred_at) AS day,
    metadata ->> 'name' AS metric, count(*) AS samples,
    round(avg((metadata->>'value')::numeric), 1) AS avg,
    round(percentile_cont(0.50) WITHIN GROUP (ORDER BY ((metadata->>'value')::numeric)::double precision)::numeric, 1) AS p50,
    round(percentile_cont(0.95) WITHIN GROUP (ORDER BY ((metadata->>'value')::numeric)::double precision)::numeric, 1) AS p95
   FROM public.client_telemetry_log
  WHERE category = 'metric' AND (metadata->>'value') ~ '^-?\d+(\.\d+)?$'
  GROUP BY tenant_id, date_trunc('day', occurred_at), metadata ->> 'name';

-- ============================================================================
-- VI.3 Edge Functions por hora (chamadas, erros, 5xx, p50/p95/p99).
-- ============================================================================
CREATE OR REPLACE VIEW public.v_ef_metrics_hourly
WITH (security_invoker = on) AS
 SELECT fn_name, date_trunc('hour', started_at) AS hour,
    count(*) AS calls,
    count(*) FILTER (WHERE status_code >= 400) AS errors,
    count(*) FILTER (WHERE status_code >= 500) AS errors_5xx,
    round(avg(duration_ms))::integer AS avg_ms,
    percentile_cont(0.5)  WITHIN GROUP (ORDER BY duration_ms::double precision)::integer AS p50_ms,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms::double precision)::integer AS p95_ms,
    percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_ms::double precision)::integer AS p99_ms,
    max(duration_ms) AS max_ms
   FROM public.ef_invocation_log
  GROUP BY fn_name, date_trunc('hour', started_at);

-- ============================================================================
-- VI.4 Eventos de domínio (funil, 90d) e dead-letter de notificações.
-- ============================================================================
CREATE OR REPLACE VIEW public.v_domain_events_daily
WITH (security_invoker = on) AS
 SELECT date_trunc('day', occurred_at) AS day,
    metadata ->> 'event' AS event,
    COALESCE(metadata ->> 'area', split_part(metadata ->> 'event','.',1)) AS area,
    count(*) AS total, count(DISTINCT session_id) AS sessions,
    count(DISTINCT member_id) AS members, count(DISTINCT tenant_id) AS tenants,
    max(occurred_at) AS last_seen
   FROM public.client_telemetry_log
  WHERE category = 'domain' AND (metadata ->> 'event') IS NOT NULL AND occurred_at >= now() - interval '90 days'
  GROUP BY date_trunc('day', occurred_at), metadata ->> 'event',
           COALESCE(metadata ->> 'area', split_part(metadata ->> 'event','.',1));

-- ADAPTADA ao GEOLAB: notify_event_outbox no lugar de webhook_event_queue.
-- "Dead-letter": evento não processado, ≥5 tentativas, parado há >1h. Mesmos nomes de saída p/ o alarme.
CREATE OR REPLACE VIEW public.v_webhook_dead_letter_alerts
WITH (security_invoker = on) AS
 SELECT tenant_id, count(*) AS dead_letter_count, min(created_at) AS oldest_dead_at,
    max(last_error) AS sample_error,
    array_agg(DISTINCT event_type) FILTER (WHERE event_type IS NOT NULL) AS events_affected
   FROM public.notify_event_outbox
  WHERE processed_at IS NULL AND attempts >= 5 AND created_at < now() - interval '1 hour'
  GROUP BY tenant_id;

-- ============================================================================
-- VI.5 Gestão de incidentes e MTTR (a partir de telemetry_alert).
-- ============================================================================
CREATE OR REPLACE VIEW public.v_telemetry_incident_stats
WITH (security_invoker = on) AS
 SELECT alert_key, max(kind) AS kind, count(*) AS total_incidents,
    count(*) FILTER (WHERE status = 'open') AS open_incidents,
    count(*) FILTER (WHERE resolved_at IS NOT NULL) AS resolved_incidents,
    count(*) FILTER (WHERE severity = 'critical') AS critical_incidents,
    sum(occurrences) AS total_occurrences,
    round(avg(EXTRACT(epoch FROM resolved_at - first_seen_at)/60.0) FILTER (WHERE resolved_at IS NOT NULL), 1) AS avg_mttr_minutes,
    round(percentile_cont(0.5) WITHIN GROUP (ORDER BY (EXTRACT(epoch FROM resolved_at - first_seen_at)/60.0)::double precision)::numeric, 1) AS median_mttr_minutes,
    round(max(EXTRACT(epoch FROM resolved_at - first_seen_at)/60.0) FILTER (WHERE resolved_at IS NOT NULL), 1) AS max_mttr_minutes,
    min(first_seen_at) AS first_incident_at, max(last_seen_at) AS last_seen_at,
    max(resolved_at) AS last_resolved_at, bool_or(status = 'open') AS currently_open
   FROM public.telemetry_alert GROUP BY alert_key;

CREATE OR REPLACE VIEW public.v_telemetry_mttr_summary
WITH (security_invoker = on) AS
 SELECT count(*) FILTER (WHERE status = 'open') AS open_incidents,
    count(*) FILTER (WHERE first_seen_at >= now() - interval '30 days') AS incidents_30d,
    count(*) FILTER (WHERE resolved_at IS NOT NULL AND first_seen_at >= now() - interval '30 days') AS resolved_30d,
    count(*) FILTER (WHERE severity = 'critical' AND first_seen_at >= now() - interval '30 days') AS critical_30d,
    count(DISTINCT alert_key) FILTER (WHERE first_seen_at >= now() - interval '30 days') AS distinct_keys_30d,
    round(avg(EXTRACT(epoch FROM resolved_at - first_seen_at)/60.0) FILTER (WHERE resolved_at IS NOT NULL AND first_seen_at >= now() - interval '30 days'), 1) AS avg_mttr_minutes_30d,
    round(max(EXTRACT(epoch FROM resolved_at - first_seen_at)/60.0) FILTER (WHERE resolved_at IS NOT NULL AND first_seen_at >= now() - interval '30 days'), 1) AS max_mttr_minutes_30d
   FROM public.telemetry_alert;

-- ============================================================================
-- Grants — security_invoker=on: o consumidor precisa de SELECT na view e RLS nas bases (admin-only).
--   Painel (admin authenticated) e alarme (service_role).
-- ============================================================================
GRANT SELECT ON public.v_client_health_by_version    TO authenticated, service_role;
GRANT SELECT ON public.v_release_health              TO authenticated, service_role;
GRANT SELECT ON public.v_client_vitals_daily         TO authenticated, service_role;
GRANT SELECT ON public.v_client_metric_daily         TO authenticated, service_role;
GRANT SELECT ON public.v_ef_metrics_hourly           TO authenticated, service_role;
GRANT SELECT ON public.v_domain_events_daily         TO authenticated, service_role;
GRANT SELECT ON public.v_webhook_dead_letter_alerts  TO authenticated, service_role;
GRANT SELECT ON public.v_telemetry_incident_stats    TO authenticated, service_role;
GRANT SELECT ON public.v_telemetry_mttr_summary      TO authenticated, service_role;

-- NOTA: v_webhook_dead_letter_alerts no painel só mostra linhas se notify_event_outbox for legível pelo
-- admin (RLS). O alarme (service_role) sempre enxerga. Se o painel precisar exibir, garantir uma policy
-- de SELECT admin em notify_event_outbox (fora do escopo desta migration).

-- FIM 050. Próxima: EF de ingestão client-telemetry + _shared/security.ts (Camada 4),
-- depois SDK frontend (Camada 5), serveWithTelemetry (Camada 6), alarmes (Camada 7), cron (Camada 8).
