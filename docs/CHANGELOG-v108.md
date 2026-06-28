# CHANGELOG — v108 (Gestão de e-mails · A1 — detalhe por destinatário)

**APP_VERSION:** v107 → **v108** · **CACHE_NAME:** consultegeo-geolab-v107 → **…-v108**
**Build:** `npm run build` verde (check-source · biome · tsc · vitest 18/18 · vite).
**Migration:** nenhuma — **frontend puro** (os dados já existiam em `notification_dispatch_log`).

Primeiro item do `docs/BACKLOG-FRONTEND-EMAILS.md` (Grupo A). Transforma o histórico de e-mails de
"log read-only" em algo inspecionável: clicar numa linha abre o ciclo de vida completo daquele envio.

## Frontend
- `src/lib/api/emails.ts` — `DispatchLogRow` e `LOG_SELECT` ampliados com `notification_type`, `dedupe_key`,
  `last_clicked_url`, `last_user_agent`, `updated_at` (além dos já existentes `delivered_at`/`opened_at`/
  `clicked_at`/`bounced_at`/`complained_at`/`open_count`/`click_count`/`entity_*`/`resend_id`/`metadata`).
- `src/pages/gestao/EmailLogPage.tsx`:
  - Linha do histórico agora é **clicável** (cursor + hover) e abre um **Modal de detalhe**.
  - **Escada de ciclo de vida**: Enviado → Entregue → Aberto → Clicado → (Bounce / Reclamação), cada etapa com
    timestamp e indicador (verde = atingida, vermelho = negativa, cinza = não registrada). A 1ª etapa reflete o
    estado real (Enviado / Na fila / Suprimido / Pulado / Falha) em vez de assumir "enviado".
  - Grade de metadados: tipo do evento, status, resend_id, dedupe, entidade de origem, última atividade,
    último link clicado, user-agent, erro/motivo + `metadata` em `<details>`.
  - Helpers locais `fmtDT`, `Etapa`, `Info`. **Sem query extra** — o modal usa a própria linha já carregada.

## Observações
- 100% FE; nenhuma escrita no banco. A escrita/edição (allowlist, supressões, templates) é de itens posteriores
  do backlog (A6/A7/A8).
- Próximos sugeridos no backlog: **A5** (deep-link "Abrir registro" usando `entity_type/entity_id`, que o detalhe
  já exibe) e **A6** (gerenciar supressões).

## Arquivos
`src/lib/api/emails.ts`, `src/pages/gestao/EmailLogPage.tsx`, `src/lib/telemetry/core.ts`, `public/sw.js`,
`SOURCE_VERSION.md`, `docs/CHANGELOG-v108.md`.
