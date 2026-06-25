-- 048_observabilidade_core.sql — Observabilidade & Telemetria (Camada 1: modelo de dados)
-- Alvo: GEOLAB (Concresoft). Spec: OBSERVABILIDADE.md §IV. Doador de referência: GEOCON (220-223, v282).
-- Aditiva e idempotente. Aplicar via MCP `apply_migration` (uma a uma; `list_migrations` antes/depois).
-- NÃO TESTÁVEL no sandbox (depende do schema vivo: has_role, members, gen_random_uuid). Validar no banco.
--
-- Adaptações vs doador GEOCON:
--   * has_role é de ARGUMENTO ÚNICO no GEOLAB → has_role('admin') (NÃO ARRAY['admin']).
--   * Tabela client_telemetry_log criada AQUI já com error_fingerprint (no GEOCON era ALTER posterior).
--   * RLS habilitada em TODAS as 9 tabelas (invariante GEOLAB "100% RLS"); escrita só via
--     SECURITY DEFINER/service-role (cliente nunca escreve direto).
--   * telemetry_settings = schema COMPLETO da spec §IX.6 (inclui colunas de domínio alert_ops_*/
--     alert_schedule_*; ficam DESLIGADAS por default — evita ALTER futuro e mantém o alarme portável).
--
-- Objetos criados: 9 tabelas, índices, 2 funções (fingerprint + trigger fn), 1 trigger, policies RLS.
-- As funções SECURITY DEFINER de apoio (log_ef_invocation, bump_rate_limit, raise/resolve, rollup,
-- prune, app_trace_id, telemetry_admin_member_ids) e as views vêm nas migrations 049 e 050.

-- ============================================================================
-- 1) telemetry_settings — configuração viva (singleton id=1). Operar = UPDATE aqui (sem deploy).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.telemetry_settings (
  id                                integer PRIMARY KEY DEFAULT 1,
  -- ingestão / global
  ingest_enabled                    boolean NOT NULL DEFAULT true,   -- kill-switch da ingestão
  sample_rate                       numeric NOT NULL DEFAULT 1.0 CHECK (sample_rate >= 0 AND sample_rate <= 1),
  alerting_enabled                  boolean NOT NULL DEFAULT true,   -- master switch do alerting
  -- RUM (cliente)
  alert_error_rate_pct              numeric NOT NULL DEFAULT 5,
  alert_min_events                  integer NOT NULL DEFAULT 20,
  alert_lcp_p75_ms                  integer NOT NULL DEFAULT 4000,
  alert_inp_p75_ms                  integer NOT NULL DEFAULT 500,
  alert_cls_p75                     numeric NOT NULL DEFAULT 0.25,
  alert_fcp_p75_ms                  integer NOT NULL DEFAULT 3000,
  alert_ttfb_p75_ms                 integer NOT NULL DEFAULT 1800,
  alert_vital_min_samples           integer NOT NULL DEFAULT 5,
  -- canais de notificação
  alert_notify_inapp                boolean NOT NULL DEFAULT true,
  alert_notify_email                boolean NOT NULL DEFAULT false,
  alert_notify_webhook_url          text,
  alert_cron_enabled                boolean NOT NULL DEFAULT true,
  -- Edge Functions
  alert_ef_p95_ms                   integer NOT NULL DEFAULT 3000,
  alert_ef_5xx_min                  integer NOT NULL DEFAULT 3,
  alert_ef_5xx_window_hours         integer NOT NULL DEFAULT 6,
  alert_ef_latency_exempt           text[]  NOT NULL DEFAULT ARRAY['backup-'],
  -- webhooks / fila
  alert_webhook_dead_letter         integer NOT NULL DEFAULT 5,
  -- Postgres (pg_stat_statements, dead tuples, tamanho)
  alert_pg_enabled                  boolean NOT NULL DEFAULT true,
  alert_pg_mean_ms                  numeric NOT NULL DEFAULT 1500,
  alert_pg_min_calls                integer NOT NULL DEFAULT 50,
  alert_pg_dead_pct                 numeric NOT NULL DEFAULT 25,
  alert_pg_min_table_bytes          bigint  NOT NULL DEFAULT 10485760,
  -- release health (crash-free) — desligado até haver volume de sessões
  alert_crash_free_enabled          boolean NOT NULL DEFAULT false,
  alert_crash_free_min_pct          numeric NOT NULL DEFAULT 95,
  alert_release_min_sessions        integer NOT NULL DEFAULT 20,
  -- e-mail transacional (Resend)
  alert_email_enabled               boolean NOT NULL DEFAULT true,
  alert_email_min_sent              integer NOT NULL DEFAULT 20,
  alert_email_bounce_pct            numeric NOT NULL DEFAULT 5.0,
  alert_email_complaint_pct         numeric NOT NULL DEFAULT 0.1,
  alert_email_window_hours          integer NOT NULL DEFAULT 24,
  -- operacional (domínio — desligado por default no GEOLAB; ligar quando houver os sinais)
  alert_ops_enabled                 boolean NOT NULL DEFAULT false,
  alert_ops_identity_errors         integer NOT NULL DEFAULT 3,
  alert_ops_queue_backlog           integer NOT NULL DEFAULT 10,
  alert_ops_queue_max_attempts      integer NOT NULL DEFAULT 5,
  alert_ops_audit_anon              integer NOT NULL DEFAULT 3,
  alert_ops_auth_failures           integer NOT NULL DEFAULT 10,
  alert_ops_auth_failures_per_user  integer NOT NULL DEFAULT 5,
  alert_ops_env_overdue             integer NOT NULL DEFAULT 5,
  -- cronograma físico-financeiro (domínio GeoCon — desligado no GEOLAB)
  alert_schedule_enabled            boolean NOT NULL DEFAULT false,
  alert_schedule_coverage_pct       numeric NOT NULL DEFAULT 105,
  updated_at                        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telemetry_settings_singleton CHECK (id = 1)
);
INSERT INTO public.telemetry_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2) client_telemetry_log — eventos do cliente (logs, web-vitals, métricas, domínio)
--    Vocabulário (ALINHAR o SDK na Camada 5): occurred_at|level|category|message|url + metadata.{name,value,rating}
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.client_telemetry_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at       timestamptz NOT NULL,
  level             text NOT NULL,                 -- debug|info|warn|error|fatal
  category          text NOT NULL,                 -- 'web-vital'|'metric'|'domain'|'window.error'|...
  message           text NOT NULL,
  stack             text,
  url               text,
  user_agent        text,
  member_id         uuid,                          -- carimbado pela ingestão (via JWT)
  tenant_id         uuid,
  app_version       text,
  session_id        text,
  metadata          jsonb DEFAULT '{}'::jsonb,     -- {name,value,rating,unit} vitais/métricas; {event,area} domínio; {trace_id}
  ip_address        inet,
  created_at        timestamptz DEFAULT now(),
  error_fingerprint text                           -- preenchido por trigger só p/ error|fatal
);

CREATE INDEX IF NOT EXISTS idx_client_telemetry_category_occurred
  ON public.client_telemetry_log (category, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_telemetry_fingerprint
  ON public.client_telemetry_log (error_fingerprint, occurred_at DESC)
  WHERE level = ANY (ARRAY['error','fatal']);
CREATE INDEX IF NOT EXISTS idx_client_telemetry_log_level_created
  ON public.client_telemetry_log (level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_telemetry_log_tenant_created
  ON public.client_telemetry_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_telemetry_metric_name
  ON public.client_telemetry_log (((metadata ->> 'name')))
  WHERE category = ANY (ARRAY['web-vital','metric']);

-- 2.1) Fingerprint estável de erro (agrupamento). Puro/IMMUTABLE — corpo do GEOCON v282.
--      Normaliza uuid/url/hex/números na mensagem e extrai a 1ª função nomeada do stack.
CREATE OR REPLACE FUNCTION public.telemetry_error_fingerprint(
  p_category text, p_message text, p_stack text
) RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT md5(
    lower(coalesce(p_category,''))
    || '|' ||
    btrim(regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(lower(coalesce(p_message,'')),
              '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}','<uuid>','g'),
            'https?://\S+','<url>','g'),
          '0x[0-9a-f]+|\m[0-9a-f]{8,}\M','<hex>','g'),
        '\d+','<n>','g'),
      '\s+',' ','g'))
    || '|' ||
    coalesce((regexp_match(coalesce(p_stack,''),'at\s+([A-Za-z_$][\w$.]*)'))[1],'')
  );
$$;

-- 2.2) Trigger fn: só calcula fingerprint para error|fatal.
CREATE OR REPLACE FUNCTION public.tg_client_telemetry_set_fingerprint()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF new.level IN ('error','fatal') THEN
    new.error_fingerprint := public.telemetry_error_fingerprint(new.category, new.message, new.stack);
  ELSE
    new.error_fingerprint := null;
  END IF;
  RETURN new;
END;
$$;

-- 2.3) Trigger (CREATE OR REPLACE — PG15; sem DROP).
CREATE OR REPLACE TRIGGER trg_client_telemetry_fingerprint
  BEFORE INSERT OR UPDATE OF level, category, message, stack
  ON public.client_telemetry_log
  FOR EACH ROW EXECUTE FUNCTION public.tg_client_telemetry_set_fingerprint();

-- ============================================================================
-- 3) ef_invocation_log — latência/erros de toda Edge Function (via serveWithTelemetry)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ef_invocation_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fn_name       text NOT NULL,
  started_at    timestamptz NOT NULL,
  duration_ms   integer NOT NULL,
  status_code   integer NOT NULL,
  error_message text,
  actor_id      uuid,
  tenant_id     uuid,
  request_id    text,
  metadata      jsonb,                 -- {method, path, trace_id?}
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ef_invocation_log_fn_started
  ON public.ef_invocation_log (fn_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ef_invocation_log_tenant_started
  ON public.ef_invocation_log (tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ef_invocation_trace
  ON public.ef_invocation_log (((metadata ->> 'trace_id'))) WHERE metadata ? 'trace_id';

-- ============================================================================
-- 4) cron_heartbeat — watchdog de jobs agendados
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cron_heartbeat (
  job_name                 text PRIMARY KEY,
  last_seen_at             timestamptz NOT NULL DEFAULT now(),
  expected_max_age_minutes integer NOT NULL,
  last_status              text,                -- ok|success|warning|error
  last_error               text,
  consecutive_failures     integer NOT NULL DEFAULT 0,
  total_runs               bigint  NOT NULL DEFAULT 0,
  total_failures           bigint  NOT NULL DEFAULT 0,
  active                   boolean NOT NULL DEFAULT true,
  description              text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5) telemetry_alert — incidentes (abertos/resolvidos). 1 ABERTO por chave (idempotência do raise).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.telemetry_alert (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key     text NOT NULL,                    -- ex.: 'ef:send-notification', 'vital:LCP'
  kind          text NOT NULL,                    -- error_rate|web_vital|cron|webhook|edge_function|ops_health|...
  severity      text NOT NULL DEFAULT 'warning',  -- warning|critical
  status        text NOT NULL DEFAULT 'open',     -- open|resolved
  title         text NOT NULL,
  detail        text,
  metric        text,
  observed      numeric,
  threshold     numeric,
  app_version   text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  occurrences   integer NOT NULL DEFAULT 1
);
-- ÍNDICE-CHAVE: torna raise_telemetry_alert seguro a cada minuto (ON CONFLICT WHERE status='open'). NÃO REMOVER.
CREATE UNIQUE INDEX IF NOT EXISTS uq_telemetry_alert_open
  ON public.telemetry_alert (alert_key) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_telemetry_alert_status_seen
  ON public.telemetry_alert (status, last_seen_at DESC);

-- ============================================================================
-- 6) telemetry_error_group — triagem manual de erros por fingerprint
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.telemetry_error_group (
  fingerprint text PRIMARY KEY,            -- = client_telemetry_log.error_fingerprint
  status      text NOT NULL DEFAULT 'open',-- open|resolved
  note        text,
  muted_until timestamptz,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 7) telemetry_rollup_daily — agregados diários (séries longas baratas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.telemetry_rollup_daily (
  day               date NOT NULL,
  scope             text NOT NULL,     -- 'client_error' | 'ef' | 'vital'
  dim               text NOT NULL,     -- versão | fn_name | métrica…
  samples           bigint NOT NULL DEFAULT 0,
  errors            bigint,
  errors_5xx        bigint,
  p75               numeric,
  p95               numeric,
  good              bigint,
  needs_improvement bigint,
  poor              bigint,
  computed_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, scope, dim)
);

-- ============================================================================
-- 8) frontend_canary_checks — disponibilidade externa do frontend (pg_net → sw.js)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.frontend_canary_checks (
  id           bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  request_id   bigint,                 -- id da requisição pg_net (net.http_get)
  url          text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  evaluated_at timestamptz,
  status_code  integer,
  ok           boolean,
  cache_name   text,                   -- versão extraída do sw.js servido (consultegeo-geolab-vNN)
  error        text
);

-- ============================================================================
-- 9) client_telemetry_rate_limit — balde por minuto da ingestão (escrito por SECURITY DEFINER)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.client_telemetry_rate_limit (
  actor_key    text NOT NULL,          -- '<ip>:<session_id>'
  bucket_start timestamptz NOT NULL,   -- minuto truncado
  calls        integer NOT NULL DEFAULT 0,
  PRIMARY KEY (actor_key, bucket_start)
);

-- ============================================================================
-- 10) RLS — habilitar em TODAS as 9 tabelas; leitura só admin via has_role('admin').
--     Escrita sempre por SECURITY DEFINER/service-role (que ignora RLS). Cliente nunca escreve direto.
--     Policies idempotentes via guarda em pg_policies (sem DROP).
-- ============================================================================
ALTER TABLE public.telemetry_settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_telemetry_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ef_invocation_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_heartbeat               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_alert              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_error_group        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_rollup_daily       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frontend_canary_checks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_telemetry_rate_limit  ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- SELECT só-admin
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='telemetry_settings' AND policyname='telemetry_settings_admin_select') THEN
    CREATE POLICY telemetry_settings_admin_select ON public.telemetry_settings FOR SELECT TO authenticated USING (public.has_role('admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='telemetry_settings' AND policyname='telemetry_settings_admin_update') THEN
    CREATE POLICY telemetry_settings_admin_update ON public.telemetry_settings FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='client_telemetry_log' AND policyname='client_telemetry_admin_select') THEN
    CREATE POLICY client_telemetry_admin_select ON public.client_telemetry_log FOR SELECT TO authenticated USING (public.has_role('admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ef_invocation_log' AND policyname='ef_invocation_admin_select') THEN
    CREATE POLICY ef_invocation_admin_select ON public.ef_invocation_log FOR SELECT TO authenticated USING (public.has_role('admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cron_heartbeat' AND policyname='cron_heartbeat_admin_select') THEN
    CREATE POLICY cron_heartbeat_admin_select ON public.cron_heartbeat FOR SELECT TO authenticated USING (public.has_role('admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='telemetry_alert' AND policyname='telemetry_alert_admin_select') THEN
    CREATE POLICY telemetry_alert_admin_select ON public.telemetry_alert FOR SELECT TO authenticated USING (public.has_role('admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='telemetry_alert' AND policyname='telemetry_alert_admin_update') THEN
    CREATE POLICY telemetry_alert_admin_update ON public.telemetry_alert FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='telemetry_error_group' AND policyname='telemetry_error_group_admin_select') THEN
    CREATE POLICY telemetry_error_group_admin_select ON public.telemetry_error_group FOR SELECT TO authenticated USING (public.has_role('admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='telemetry_error_group' AND policyname='telemetry_error_group_admin_update') THEN
    CREATE POLICY telemetry_error_group_admin_update ON public.telemetry_error_group FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='telemetry_rollup_daily' AND policyname='telemetry_rollup_daily_admin_select') THEN
    CREATE POLICY telemetry_rollup_daily_admin_select ON public.telemetry_rollup_daily FOR SELECT TO authenticated USING (public.has_role('admin'));
  END IF;

  -- frontend_canary_checks e client_telemetry_rate_limit: RLS ON, SEM policy de SELECT.
  -- São consultadas via funções/admin (canário) e só escritas por SECURITY DEFINER (rate-limit).
  -- O painel (Camada 9) lê o canário por função SECURITY DEFINER; se preferir leitura direta,
  -- adicionar aqui um SELECT has_role('admin') na 050/051.
END $$;

-- ============================================================================
-- 11) GRANTS — RLS faz o filtro; o role precisa do privilégio de tabela. Coerente com as policies.
--     Canário e rate-limit: sem grant a authenticated (só service-role).
-- ============================================================================
GRANT SELECT, UPDATE ON public.telemetry_settings    TO authenticated;
GRANT SELECT         ON public.client_telemetry_log  TO authenticated;
GRANT SELECT         ON public.ef_invocation_log      TO authenticated;
GRANT SELECT         ON public.cron_heartbeat         TO authenticated;
GRANT SELECT, UPDATE ON public.telemetry_alert        TO authenticated;
GRANT SELECT, UPDATE ON public.telemetry_error_group  TO authenticated;
GRANT SELECT         ON public.telemetry_rollup_daily TO authenticated;

-- FIM 048. Próxima: 049_observabilidade_funcoes.sql (log_ef_invocation, bump_rate_limit, raise/resolve,
-- rollup, prune, app_trace_id, telemetry_admin_member_ids; REVOKE EXECUTE FROM anon em todas).
