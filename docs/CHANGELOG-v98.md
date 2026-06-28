# GEOLAB → Concresoft — v98 (consolida 3 trilhas de backend já vivas + 2 telas admin)

`CACHE_NAME consultegeo-geolab-v98` · `APP_VERSION v98`.

## O que é a v98
As 3 trilhas de **Backup**, **E-mail (dispatcher/quiet-hours)** e **Telemetria (ops/heartbeat)** foram aplicadas
**direto na produção** (`xbdvyvvxvzmcosnekmfv`) numa sessão anterior, **sem preservar o fonte**. A v98 **reconstrói o
fonte byte-a-byte** a partir do banco/Functions vivos (introspecção read-only via MCP, md5 conferido nas migrations)
e o **integra** ao source v97, mais **2 telas de administração** (Backups e E-mails) que leem o que as trilhas gravam.

Nada aqui precisa ser reaplicado na produção (já está live). Este pacote serve para o **repo ficar fiel ao vivo** e
para o **frontend novo** (telas) ir ao ar no próximo deploy do Netlify.

---

## 1) Migrations reconstruídas (071–077)

Renumeradas no repo como 071–077 (na produção têm nomes descritivos `20260626*`). Ordem de aplicação = numérica.

| # | Arquivo | Conteúdo |
|---|---------|----------|
| 071 | `071_backup_foundation_log_and_coverage.sql` | tabela `backup_log` + índices + **RLS admin-only** (`backup_log_admin_select`) + função `list_public_tables()` (cobertura dinâmica do dump). |
| 072 | `072_email_dispatcher_quiet_hours_scan.sql` | `notify_event_dispatch(jsonb)` (dispatcher SQL) + `is_in_quiet_hours(member,event)` + `notify_scan_calibracao(p_days=30)`. |
| 073 | `073_email_scan_resultado_abaixo_fck.sql` | `notify_scan_resultado_abaixo_fck` (NC `tipo_code='T-02'`, deep-link `/nao-conformidades`). |
| 074 | `074_email_scan_cp_atrasado.sql` | `notify_scan_cp_atrasado` (NC `tipo_code='T-10'`, deep-link `/rompimentos`). |
| 075 | `075_telemetry_ops_alarm.sql` | `telemetry_ops_alarm_run()` — saúde de ops (backlog do outbox + dead-letter) + coluna `alert_ops_queue_minutes`. |
| 076 | `076_telemetry_unified_critical_notification.sql` | `telemetry_notify_pending_alerts()` — notificador central (kinds `pg_%`/`release_health`/`email_health`/`ops_health`/`schedule_health`/`frontend_health`; coluna `notified_at` p/ uma notificação por incidente) + runner de ops simplificado. |
| 077 | `077_telemetry_heartbeat_decouple_runners.sql` | desacopla o heartbeat dos runners (pg/email/release): caminho de sucesso passa de `warning`→`ok` (mata o `cron:<job>` crítico em cascata). |

> ⚠️ **DEPENDÊNCIA (065–070 não estão nesta pasta).** A 072 referencia objetos do **núcleo de notificação**
> (`notify_event_outbox`, `notification_dispatch_settings`, `member_notification_prefs`, `notification_event_types`,
> `notification_dispatch_log`) criados nas migrations **065–070**, que **não constam** em `supabase/migrations/` (a
> pasta do repo é um espelho **parcial** do histórico — ver §6). Em produção esses objetos existem; num banco zerado,
> aplicar 071–077 **sem** 065–070 falharia. Tratar 065–070 como pré-requisito (estão vivos no projeto de produção).

Validação: as 7 passam `pglast` (v7.14). Conferência de fidelidade: md5 de cada uma confere com o vivo
(extração base64 a partir de `supabase_migrations.schema_migrations`, decodificada em Python).

---

## 2) Edge Functions (8 novas + 1 atualizada)

Todas **self-contained** (só `npm:@supabase/supabase-js@2.45.4`, sem `_shared`) e **`verify_jwt=false`**
(blocos adicionados em `supabase/config.toml`). Puxadas byte-a-byte do vivo; passam `esbuild`.

**Backup (6):**
- `cron-backup` **v8** — dump lógico (cobertura dinâmica + exclusion-list) → bucket `backups`, auto-verificação SHA-256, `backup_log`, heartbeat. Agendada `15 3 * * *`.
- `backup-storage-real` **v1** — manifesto dos objetos de Storage. `45 3 * * *`.
- `backup-health-check` **v1** — confere backup de banco **e** storage nas últimas 36h (aceita `success` **e** `verified`). `30 8 * * *`.
- `backup-prune` **v1** — retenção do bucket `backups` (mantém os `keep_min` mais recentes por prefixo). Semanal.
- `backup-restore-drill` **v1** — prova de restaurabilidade 100% read-only (integridade + parse + cobertura + drift). `0 5 * * 0`.
- `prune-storage-retention` **v1** — relatório de órfãos dos buckets de conteúdo, **modo relatório (NÃO apaga)**. `20 4 * * 0`.

**E-mail (2):**
- `notify-event` **v8** — fan-out por papel (`role_notification_types`) → `send-notification`. Marca o outbox como `processed` mesmo sem destinatários (corrige falso backlog).
- `send-notification` **v11** — **único** ponto de saída Resend. Gates: auth → inativo → preferência → papel → **quiet-hours** (`is_in_quiet_hours`, fail-open) → allowlist → supressão → dispatch/dry-run. Branding Concresoft.

**Telemetria (1):**
- `telemetry-alarm` **v5** — **sobrescreve** a versão antiga do repo. Heartbeat de sucesso `warning`→`ok`; e-mail dos críticos alinhado ao contrato do hub (`x-notify-secret` + `member_id` + `deep_link`).

Segredos exigidos (já configurados em produção): `CRON_SECRET` (todas as de backup + telemetry-alarm via cron),
`RESEND_API_KEY` (+ `RESEND_FROM_EMAIL`/`APP_URL`) no `send-notification`, e `dispatch_secret` da tabela
`notification_dispatch_settings` (header `x-notify-secret` entre `notify-event`/`telemetry-alarm` → `send-notification`).

---

## 3) Telas de administração (frontend novo)

Duas páginas **admin-only** (`hasRole('admin','admin_consulte')`), no padrão da `ObservabilidadePage`
(`PageHeader`/`Card`/`Stat`/`State`, TanStack Query, auto-refresh 60s, pills Tailwind):

- **`/gestao/backups`** → `src/pages/gestao/BackupsPage.tsx` (usa `src/lib/api/backup.ts`): cartões de cobertura por
  tipo, tabela do `backup_log` e saúde dos jobs de backup (`cron_heartbeat`). **Somente leitura** — as Functions de
  backup só rodam por cron com `x-cron-secret`, nunca pelo navegador.
- **`/gestao/emails`** → `src/pages/gestao/EmailLogPage.tsx` (usa `src/lib/api/emails.ts`): contadores por status,
  **painel de despacho** com toggles `dispatch_enabled`/`dry_run` (UPDATE liberado por `has_role('admin_consulte')`),
  histórico do `notification_dispatch_log` (filtro por status) e backlog do `notify_event_outbox`.

Rotas adicionadas em `src/App.tsx` (lazy + gate `podeOperacao`); itens de menu em `src/components/Layout.tsx`
(seção “Operação interna”, ícones `Download`/`FileText`).

**Estado atual do despacho (produção):** `dispatch_enabled=false` e `dry_run=true` → **nenhum e-mail real é
enviado** (eventos ficam como `queued`). A tela de E-mails mostra um banner claro quando o envio real estiver ativo.
As leituras de log/outbox **sempre filtram `tenant_id` explicitamente** (além da RLS `is_tenant_member`), evitando
full-scan em escala. `dispatch_secret` **nunca** é selecionado pelo cliente.

> As tabelas novas (`backup_log`, `notification_dispatch_*`, `notify_event_outbox`) ainda **não** estão em
> `database.types.ts`. Por isso `backup.ts`/`emails.ts` usam o cast permissivo `const db = supabase as unknown as
> { from }` (mesmo padrão de `client.ts`) — o `tsc` passa **sem** regenerar tipos. Regenerar `database.types.ts`
> continua recomendável quando for tipar essas tabelas.

---

## 4) ⚠️ Pendência arquitetural (NÃO resolvida nesta entrega — decisão sua)

`cron-watchdog` **v7** emite `cp_atrasado` e `calibracao_vencendo` com **dedupe keys que colidem** com os novos scans
(migrations 074 `cp_atrasado` e 072 `calibracao`) → **risco latente de notificação duplicada**. Decidir entre:
**(a)** remover esses dois eventos do watchdog, **(b)** desabilitar os scans, ou **(c)** alinhar as dedupe keys.
Enquanto o despacho real está OFF, não há impacto observável — mas resolver antes de ligar o envio.

---

## 5) ⚠️ Correção de build pré-existente (fora do escopo das trilhas, mas necessária)

A v97 enviada **já falhava** `npm run build` no passo `biome lint src` (Biome **2.5.1**, o mesmo pinado):
`src/lib/export/xlsx.ts:141` disparava `lint/suspicious/noControlCharactersInRegex` por causa de `/[^\x00-\x7F]/g`
(o `\x00` e o `\x7F` são caracteres de controle). Trocado por um **equivalente sem caracteres de controle**:
`/[\u0080-\uffff]/g` (remove tudo ≥ 0x80; idêntico após `normalize('NFD')`). Sem mudança de comportamento.
Se o seu pipeline real não roda `biome lint` como gate duro, é seguro reverter — está isolado em 1 linha.

---

## 6) Caveat: `supabase/migrations/` é espelho parcial

A pasta tem 029–064 (com lacunas: faltam 048, 057–062) **e** as novas 071–077, mas **não** tem 001–028 nem 065–070.
É uma condição **pré-existente** do source v97 (o backend sempre foi aplicado via MCP). A produção tem o histórico
completo. Para um banco do zero, use o histórico de produção como fonte de verdade (065–070 são pré-requisito da 072).

---

## 7) Validação executada nesta entrega

Cadeia `npm run build` completa, **verde**, contra a árvore integrada:
`check-source.mjs` OK · `biome lint src` OK (0 erros) · `tsc --noEmit` OK · `vitest run` 18/18 · `vite build` OK.
Migrations: `pglast` 7/7. Edge Functions: `esbuild` 9/9.

## 8) Aplicar (frontend)
1. `unzip -o consultegeo-geolab-source-completo-v98.zip` na raiz (ou o `-patches-` para delta).
2. `npm ci && npm run build` (deve ficar verde).
3. `git add -A && git commit -m "v98: consolida trilhas backup/e-mail/telemetria + telas admin + fix biome xlsx" && git push`.
4. Backend: **nada a reaplicar** (já vivo). Conferir apenas a pendência do §4 antes de ligar o despacho real.
