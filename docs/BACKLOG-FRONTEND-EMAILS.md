# Backlog — Frontend de Gestão de E-mails

> Avaliação do que pode ser implementado no **frontend** para a gestão de e-mails do GEOLAB.
> Aterrissado no backend **real** (verificado em produção via MCP, 28/06/2026), não no playbook genérico.
> Regra do projeto: **código > documentação** quando divergirem.

## Estado atual (o que já existe)

- **`/gestao/emails` — `EmailLogPage`** (escrita restrita a `has_role('admin','admin_consulte')`): banner de modo
  (envio real × dry-run) + toggles **despacho/dry-run**, contadores 7d (sent/queued/skipped/suppressed/failed +
  backlog do outbox), tabela do **outbox** (`notify_event_outbox`) e **histórico** (`notification_dispatch_log`,
  filtro por status, limite 100, auto-refresh 60s).
- **`/notificacoes` — `NotificacoesPage`**: preferências por evento (`member_notification_prefs`) + log recente.
- **APIs:** `src/lib/api/emails.ts` (`listDispatchLog`, `dispatchCountsByStatus`, `getDispatchSettings`,
  `saveDispatchSettings`, `listOutbox`) e `src/lib/api/notificacoes.ts` (`listDispatchLog`, `listMyPrefs`,
  `setMyPref`).

## Lastro de backend já disponível (subutilizado pelo front)

| Objeto | Forma | O que habilita |
|---|---|---|
| `notification_dispatch_log` | tabela | Colunas ricas **não exibidas**: `delivered_at, opened_at, clicked_at, bounced_at, complained_at, open_count, click_count, last_clicked_url, last_user_agent, entity_type, entity_id, resend_id, payload, metadata, dedupe_key, notification_type` |
| `notification_dispatch_settings` | singleton (`id=true`) | `dispatch_enabled, dry_run, email_allowlist, notify_event_url, dispatch_secret` (segredo **nunca** ao front) |
| `notify_event_outbox` | tabela | fila do dispatcher (event_type, mode, status, attempts, last_error) |
| `email_suppressions` | tabela | `email, reason, metadata, created_at` — bloqueios (hard_bounce/complaint/manual) |
| `notification_templates` | tabela | `event_type, locale, channel, subject_template, html_template, text_template, active` — override **sem deploy** |
| `notification_event_types` | tabela-catálogo | `key, codigo, categoria, severidade, descricao, default_channel, is_system, digest, active` |
| `role_notification_types` | matriz | governança por papel (quem recebe cada evento) |
| `v_email_dispatch_daily` | view | `day, event_type, total, reached, delivered, opened, clicked, bounced, complained, failed, skipped` — **⚠ sem `tenant_id` (global)** |

**Ausências confirmadas (mudam o escopo):**
- **Não há** tabela `notifications` (in-app) → GEOLAB é **e-mail-only**; não há "central de notificações" para construir
  sem backend.
- **`members` não tem** colunas de `timezone`/`quiet_hours` → *quiet hours* exige backend antes do front.

---

## A) Pronto para construir AGORA (backend já existe — só frontend)

Legenda: **Esforço** P/M/G · **Risco** baixo/médio · **Valor** ★–★★★

### A1. Detalhe por destinatário (drill-down) — ★★★ · P · baixo
Clique numa linha do log abre painel com a **escada de ciclo de vida** (enviado → entregue → aberto → clicado →
bounce/complaint) com timestamps, `open_count`/`click_count`, `last_clicked_url`, `last_user_agent`, `resend_id` e
motivo de bounce. Dados já vêm em `notification_dispatch_log` — basta ampliar o `select` e a UI.
*Maior retorno, sem backend.*

### A2. Funil + taxas de entrega — ★★★ · M · baixo
Trocar os 6 contadores planos por funil (entregue %, aberto %, clicado %, **bounce %**, **complaint %**).
**Recomendado:** RPC pequena agregando `notification_dispatch_log` **escopada por tenant** (padrão `is_tenant_member`
usado em `dashboard_kpis`/`rompimentos_resumo`). ⚠ Não usar `v_email_dispatch_daily` direto — é **global** (sem
`tenant_id`). *Único item de A que tem um toque de SQL (RPC de leitura), mas no padrão já aprovado.*

### A3. Tendência 90 dias — ★★ · M · baixo
Gráfico de volume + entregues/abertos/bounces por dia. Mesma fonte do funil (RPC por dia, por tenant).

### A4. Saúde por tipo de evento — ★★ · P · baixo
Tabela "qual evento mais dá bounce/complaint", agregando por `event_type`. Acha template/lista problemática.

### A5. "Abrir registro" (deep-link) — ★★ · P · baixo
Cada linha tem `entity_type`/`entity_id`. Virar link para o laudo/concretagem de origem. Pura navegação.

### A6. Gerenciar supressões — ★★★ · M · médio
`email_suppressions`: listar bloqueados + motivo + data; **adicionar manual**; **remover** (re-habilitar cliente que
corrigiu o e-mail). *Confirmar RLS de escrita p/ admin; se ausente, criar 1 RPC pequena (`SECURITY DEFINER` +
`is_tenant_member`/`has_role`).* Escopo: supressões são globais por e-mail — definir se a tela é admin-Consulte.

### A7. Editor de allowlist — ★★ · P · baixo
`notification_dispatch_settings.email_allowlist`. O `saveDispatchSettings` **já aceita** o patch; falta a UI de
adicionar/remover endereços (hoje só mostra a contagem). Lembrete: allowlist **vazia = passa-tudo**.

### A8. Editor de templates — ★★★ · G · médio
`notification_templates` (subject/html/text por evento+locale+canal, `active`). Admin ajusta texto **sem deploy**, com
preview e teste. *Escrita = RLS admin (confirmar).* Cuidado com `escapeHtml`/variáveis do contexto.

### A9. Catálogo de eventos + rótulos amigáveis — ★★ · P · baixo
`notification_event_types` (categoria, severidade, descrição, is_system, digest). Hoje o log mostra a chave crua
(`laudo_pronto`); usar `codigo`/`descricao` como rótulo no log, nas prefs e nos templates. Transversal (melhora A1/A4/A8/A12).

### A10. Matriz papel × evento — ★★ · M · médio
`role_notification_types`. Grade roles (admin/gestor/laboratorista/financeiro/cliente) × eventos com toggles.
*Escrita = RLS admin (confirmar).*

### A11. Busca + período + paginação no log — ★★ · M · baixo
Busca por destinatário, filtro por evento e intervalo de datas, com **paginação server-side** (mesma preocupação de
escala das listas já paginadas; `notification_dispatch_log` cresce). Hoje só há filtro por status + limite 100.

### A12. NotificacoesPage — rótulos/agrupamento + simplificar — ★ · P · baixo
Agrupar prefs por categoria (via catálogo) e assumir **e-mail on/off por evento** (não há in-app). Rótulos amigáveis.

---

## B) Alto valor, mas pedem backend

### B13. Enviar e-mail de teste ("smoke") — ★★ · P
*Pode ser FE-only* **se** `send-notification` aceitar **JWT de membro** (no GeoCon aceita — confirmar no GEOLAB).
Botão "enviar teste para mim" valida template/entrega sem esperar evento real.

### B14. Reenviar / reprocessar — ★★ · M
Reenviar um envio que falhou ou destravar item do outbox. Precisa de **RPC/EF** que rechame o hub com segurança
(não é pura tela; respeitar dedupe/gates).

### B15. Quiet hours / fuso por usuário — ★ · M
`members` não tem as colunas nem o gate `is_in_quiet_hours`. **Backend primeiro**, depois editor em `/notificacoes`.

### B16. Anonimização LGPD de um destinatário — ★ · M
Precisa da rotina de anonimização do log (redigir `recipient_email`, preservar `trace_id`). Backend.

### B17. Broadcast / comunicado (admin → vários) — ★ · G
O GeoCon tem; o GEOLAB **não** tem tabelas/EF de broadcast. Backend significativo. Baixa prioridade.

---

## Sequência recomendada

1. **A1 + A5 + A6** — transforma a tela de "log read-only" em **ferramenta de gestão** (detalhe por destinatário,
   deep-link, supressões). Backend pronto, risco baixo. *Começar por A1 (puro front, maior retorno).*
2. **A2 + A3 + A4** — funil + tendência + saúde por evento, com **1 RPC de agregação** no padrão `is_tenant_member`.
3. **A7** — editor de allowlist (rápido).
4. **A9** — catálogo/rótulos (transversal, melhora as demais).
5. **A8 + A10** — templates e matriz por papel (mais densas).
6. **A11** — busca/paginação quando o volume crescer.
7. **B13** — teste (barato) quando convier; demais itens **B** sob demanda.

## A confirmar antes de implementar (escrita)
- RLS de escrita p/ admin em `email_suppressions`, `notification_templates`, `role_notification_types` — se ausente,
  expor via **RPC pequena** (`SECURITY DEFINER`, `search_path=public`, `is_tenant_member`/`has_role`, `grant`
  `authenticated`) no padrão já usado nesta base.
- `send-notification` aceita JWT de membro? (define se B13 é FE-only).
- Funil/tendência: **sempre** agregar por tenant (a view diária é global). Preferir RPC sobre `notification_dispatch_log`.
