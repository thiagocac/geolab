# CHANGELOG — v111 (Gestão de e-mails · A9 — catálogo de eventos + rótulos amigáveis)

**APP_VERSION:** v110 → **v111** · **CACHE_NAME:** consultegeo-geolab-v110 → **…-v111**
**Build:** `npm run build` verde (check-source · biome · tsc · vitest 18/18 · vite).
**Migration:** nenhuma — **frontend puro** (`notification_event_types` já existe; RLS de SELECT = `true`).

Quarto item do `docs/BACKLOG-FRONTEND-EMAILS.md` (após A1=v108, A6=v109, A7=v110). Substitui as keys cruas de
evento (`laudo_pronto`, `cp_atrasado`…) por **rótulos legíveis** e adiciona um catálogo de referência.

## Frontend
- `src/lib/api/emails.ts` — `EventType` + `listEventTypes()` (lê `notification_event_types`).
- `src/pages/gestao/EmailLogPage.tsx`:
  - Mapa `key → EventType` (via `useMemo`) e helper `labelEvento(key)` = `descricao` (fallback para a key crua
    quando o evento não está catalogado, ex. `digest_nc`/`system`).
  - Rótulos amigáveis aplicados no **outbox**, no **histórico** e no **topo do detalhe** (key vira `title`/tooltip).
  - Detalhe ganhou **Categoria** e **Severidade** (do catálogo) e o campo "Tipo do evento" virou
    "Evento" = `descrição (key)`.
  - Novo card **Catálogo de eventos**: descrição, código, categoria, severidade, canal padrão e flags
    (sistema/digest/inativo). `warning` destacado.

## Observações
- A `NotificacoesPage` **não** foi alterada: os toggles de preferência usam uma lista curada própria (`EVENTS`),
  e trocá-la mudaria quais toggles aparecem — fora do escopo de "rótulos". Pode ser um ajuste futuro à parte.
- Próximos sugeridos no backlog: **A2** (funil + taxas de bounce/complaint via RPC de agregação por tenant — DDL,
  com confirmação antes de aplicar) e **A4** (saúde por tipo de evento).

## Arquivos
`src/lib/api/emails.ts`, `src/pages/gestao/EmailLogPage.tsx`, `src/lib/telemetry/core.ts`, `public/sw.js`,
`SOURCE_VERSION.md`, `docs/CHANGELOG-v111.md`.
