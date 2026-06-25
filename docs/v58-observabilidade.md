# GEOLAB — Observabilidade / Telemetria (payload para a v58)

Overlay com **todos os artefatos de observabilidade** implementados, organizados pelos caminhos do repo.
São arquivos **novos** e **versões completas** dos arquivos **alterados** — basta sobrepor na árvore do
GEOLAB (substituindo os alterados, adicionando os novos). Fundamentado no source **v57**.

> **Importante:** este pacote é o *payload de observabilidade*, não um release buildado. Para virar a
> **v58** de fato, ver a seção "Como vira v58". As migrations trazem o **corpo COMPLETO** (aplicar via
> MCP `apply_migration`); no seu repo o padrão é stub-comentário — troque pelos stubs depois, se quiser.

---

## Conteúdo (24 arquivos)

### Banco de dados — `supabase/migrations/` (corpo completo; aplicar via MCP, na ordem)
- `048_observabilidade_core.sql` **(novo)** — 9 tabelas + índices + RLS (`has_role('admin')`) + trigger de fingerprint + `telemetry_settings` (singleton id=1).
- `049_observabilidade_funcoes.sql` **(novo)** — 11 funções SECURITY DEFINER (`raise_telemetry_alert`, `resolve_telemetry_alerts`, `record_cron_heartbeat`, `rollup_telemetry_daily*`, `prune_client_telemetry`, `frontend_canary_run`, `app_trace_id`, `log_ef_invocation`, `bump_client_telemetry_rate_limit`, `telemetry_admin_member_ids`).
- `050_observabilidade_views.sql` **(novo)** — 9 views `security_invoker` (health por versão, release/crash-free, vitais diários, métricas de EF por hora, dead-letter, MTTR…).
- `051_observabilidade_alerting_sql.sql` **(novo)** — 3 alarmes SQL (`telemetry_pg_alarm_run`, `telemetry_release_alarm_run`, `telemetry_email_alarm_run`) + 3 crons `concresoft-*` (:20/:25/:35).
- `052_observabilidade_cron.sql` **(novo)** — 4 crons (`concresoft-frontend-canary` */15, `-telemetry-alarm` 0 *, `-telemetry-rollup` 25 3, `-telemetry-prune` 50 3). **Preencher `<PROJECT_REF>`/`<ANON_KEY>` no job do alarme.**

### Edge Functions — `supabase/functions/`
- `_shared/response.ts` **(alterado)** — +`ok()` +`serverError()`.
- `_shared/client.ts` **(alterado)** — +alias `getServiceClient`.
- `_shared/security.ts` **(novo)** — `clientIp` + `authorizeServiceOrAdmin`.
- `_shared/telemetry.ts` **(novo)** — `serveWithTelemetry` (grava `ef_invocation_log` via `log_ef_invocation`).
- `client-telemetry/index.ts` **(novo)** — ingestão da telemetria do browser (normaliza vocabulário legado→canônico; rate-limit + sample + kill-switch).
- `telemetry-alarm/index.ts` **(novo)** — alarme horário (5 sinais + resolve + heartbeat + notificação).
- `admin-create-client-user`, `client-portal-submit-programacoes`, `consulta-fiscal`, `generate-ficha-moldagem-pdf`, `generate-laudo-ensaio-pdf`, `portal-laudo-url` — **(alteradas)** — embrulhadas em `serveWithTelemetry`.
- `config.toml` **(alterado)** — declara `client-telemetry` e `telemetry-alarm` com `verify_jwt=false`.

### Frontend — `src/`
- `lib/telemetry/metrics-math.ts` **(novo)** — puro: `rateVital`, `inpFromDurations`, `buildDailySeries`.
- `lib/telemetry/metrics-math.test.ts` **(novo)** — 14 testes (passando no vitest).
- `lib/telemetry/vitals.ts` **(alterado)** — emite `web-vital` canônico + `metadata.rating`.
- `lib/supabase.ts` **(alterado)** — fetch instrumentado p/ propagação de trace (`?trace_id=` em EF; `x-trace-id` em `/rest/v1/`; toggles + fail-open).
- `pages/gestao/ObservabilidadePage.tsx` **(novo)** — painel admin `/observabilidade`.
- `App.tsx` **(alterado)** — import lazy + rota `/observabilidade` (gated admin).

---

## Ordem de aplicação (deploy)

1. **Migrations (MCP `apply_migration`, uma por vez, `list_migrations` entre cada):** `048 → 049 → 050 → 051 → 052`.
2. **Regenerar `database.types.ts`** — as tabelas/views novas precisam estar tipadas (senão o `tsc`/vite acusa "table não existe" em `supabase.from(...)`).
3. **Segredos no vault:** garantir `CRON_SECRET` (já usado pela 044) — é a comparação fail-closed do `telemetry-alarm` e a chave dos crons HTTP.
4. **Deploy das EFs (MCP `deploy_edge_function`):** `client-telemetry`, `telemetry-alarm`, e **redeploy** das 6 instrumentadas (junto com os 4 arquivos `_shared`). Conferir `ezbr_sha256`/`ezbr_sha256` mudar.
5. **052 — preencher placeholders:** trocar `<PROJECT_REF>`/`<ANON_KEY>` no job `concresoft-telemetry-alarm` (o mais seguro é copiar a forma exata do `net.http_post` do job `concresoft-nc-digest` da 044). Reconciliar o slot reservado `concresoft-telemetria`.
6. **Release de frontend (vira v58):** ver abaixo.
7. **Nav:** adicionar link para `/observabilidade` no `Layout` (seção admin).

## Como vira v58

Este overlay não buda. Para o release:
- `npm run bump v58` (bumpa **`APP_VERSION` + `CACHE_NAME` juntos** — `core.ts` e o service worker). *Não incluí `core.ts` aqui de propósito — o bump é atômico e toca o `sw.js`, que não faz parte deste payload.*
- Gate: `check-source → tsc --noEmit → vitest run → vite build`.
- Empacotar os dois zips do padrão (`-completo` + `-patches`, mesma numeração).

> O canário (`frontend_canary_run`) checa o `sw.js` por `consresoft-geolab-v[0-9]+` — funciona em qualquer versão; o bump para v58 é higiene de release, não requisito funcional.

---

## Pendências de integração (suas)

- **3 EFs fora do source** a instrumentar na versão **deployada** (mesmo wrap): `cron-nc-digest`, `extract-nf-vision`, `validar-laudo`. (As de cron devem também chamar `record_cron_heartbeat` no corpo.)
- **Contrato de notificação:** `telemetry-alarm` → `send-notification` usa o payload do GEOCON (a EF não está no source). Conferir campos (`recipient_member_id`, `send_email`, `send_in_app`, `dedupe_key`, `event_type:'system'`). **A detecção funciona sem isso** — alertas ficam em `telemetry_alert` (painel).
- **Propagação de trace (`supabase.ts`):** roda em toda chamada. Após deploy, validar que uma listagem normal continua OK; se quebrar (CORS do `x-trace-id`), pôr `TRACE_REST = false`. O `x-trace-id` só rende em auditoria se os triggers gravarem `app_trace_id()`.

## Status de validação (honesto)

- **Executado de verdade:** `metrics-math.test.ts` → **14/14 no vitest**.
- **Sintaxe validada:** SQL (pglast) nas 5 migrations; TS/TSX (esbuild) em todas as EFs e arquivos de frontend.
- **NÃO executado aqui:** build do frontend (React 19 + Vite 8 + rolldown), runtime das EFs (sem Deno no ambiente), comportamento de CORS em runtime, e os crons/alarmes (precisam de pg_cron/pg_net/vault no banco vivo). Reconferir o "estado atual" contra o código vivo antes de aplicar.

## Não incluído

- **Sentry** (`sentry.ts`) — exige `@sentry/react` no `package.json` (dep pesada) + config runtime (`SENTRY_DSN/...`) + `setTraceId` no `core.ts`. É opcional/complementar (o `client_telemetry_log` é a fonte canônica).
- Alarmes SQL **ops/measurement/schedule** (específicos do GeoCon; `alert_ops_enabled=false` por default).
