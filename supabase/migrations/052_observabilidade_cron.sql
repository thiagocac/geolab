-- 052_observabilidade_cron.sql — Observabilidade (Camada 8: orquestração pg_cron)
-- Alvo: GEOLAB. Spec: OBSERVABILIDADE.md §VIII. Depende de 049 (funções) e da EF telemetry-alarm (Camada 7).
-- Aditiva e idempotente (cron.schedule por NOME atualiza no lugar; sem DROP). Aplicar via MCP.
-- NÃO testável no sandbox (precisa de pg_cron/pg_net/vault no banco vivo).
--
-- Agenda APENAS os 4 jobs cujas funções existem no GEOLAB:
--   canário (15 min), alarme horário (EF), rollup diário, prune diário.
-- NÃO agenda os alarmes SQL pg/release/email/ops/measurement/schedule da spec — essas funções não
-- foram criadas (ops/schedule são específicas do GeoCon; pg/release/email ficam para uma etapa futura).
--
-- Convenções GEOLAB (033/044): jobs 'concresoft-<nome>'; segredo no vault como CRON_SECRET;
-- header x-cron-secret; net.http_post para /functions/v1/<ef>.

-- Extensões (já habilitadas na 032; idempotente).
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1) Canário do frontend — a cada 15 min (SQL direto; usa pg_net por dentro de frontend_canary_run).
SELECT cron.schedule('concresoft-frontend-canary', '*/15 * * * *', $$ SELECT public.frontend_canary_run(); $$);

-- 2) Alarme horário (EF telemetry-alarm) via net.http_post + x-cron-secret do vault (fail-closed na EF).
--    ADAPTAR: troque <PROJECT_REF> e <ANON_KEY> pelos MESMOS valores dos crons já existentes (033/044).
--    O mais seguro é COPIAR a forma exata do net.http_post do seu job 'concresoft-nc-digest' (044) e
--    apenas trocar o nome da função para 'telemetry-alarm' — assim a URL/apikey/segredo já ficam certos.
SELECT cron.schedule('concresoft-telemetry-alarm', '0 * * * *', $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/telemetry-alarm',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<ANON_KEY>',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$$);

-- 3) Rollup diário 03:25 — recomputa os últimos 3 dias (SQL direto).
SELECT cron.schedule('concresoft-telemetry-rollup', '25 3 * * *', $$ SELECT public.rollup_telemetry_daily_recent(3); $$);

-- 4) Prune diário 03:50 — retenção 90d/60d/2d (SQL direto).
SELECT cron.schedule('concresoft-telemetry-prune', '50 3 * * *', $$ SELECT public.prune_client_telemetry(); $$);

-- NOTA (reconciliar): a 033 reservou um slot 'concresoft-telemetria' '0 * * * *'. Se ele for um
-- placeholder não usado (provável — não havia backend de telemetria antes), remova-o para não competir
-- no minuto 0 com o alarme acima. Confira primeiro o que ele invoca:
--   SELECT jobname, schedule, command FROM cron.job WHERE jobname LIKE 'concresoft-telemetr%';
-- e, se for placeholder:  SELECT cron.unschedule('concresoft-telemetria');
-- (NÃO incluí o unschedule como statement aqui de propósito — é destrutivo e depende do que o slot faz.)

-- FIM 052. Próxima/última: Camada 9 (painel admin /observabilidade lendo as views + telemetry_alert +
-- cron_heartbeat). Opcionais: alarmes SQL pg/release/email; Sentry; propagação de trace.
