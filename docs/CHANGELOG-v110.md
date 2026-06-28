# CHANGELOG — v110 (Gestão de e-mails · A7 — editor de allowlist)

**APP_VERSION:** v109 → **v110** · **CACHE_NAME:** consultegeo-geolab-v109 → **…-v110**
**Build:** `npm run build` verde (check-source · biome · tsc · vitest 18/18 · vite).
**Migration:** nenhuma — **frontend puro** (`saveDispatchSettings` já aceitava `email_allowlist`).

Terceiro item do `docs/BACKLOG-FRONTEND-EMAILS.md` (após A1=v108, A6=v109). Antes a tela só **mostrava a
contagem** da allowlist; agora ela é **editável**.

## Frontend
- `src/pages/gestao/EmailLogPage.tsx` — no card de modo, novo **editor de allowlist**:
  - Endereços atuais como **chips** com botão × para **remover** (por endereço).
  - **Adicionar** endereço (`Field`/`Button`): normaliza `lower(trim)`, ignora duplicado.
  - **Liberar todos** (esvazia a allowlist) com `confirm` destrutivo.
  - Texto deixa explícita a semântica: **allowlist vazia = todos recebem em envio real; com endereços = só eles**.
  - Persistência via `saveDispatchSettings({ email_allowlist })` — grava **`null`** quando esvaziada (pass-all),
    reusa `saving`/`saveMsg` e `settings.refetch()` (mesmo padrão dos toggles).
- Edição restrita a `podeEditar` (`admin`/`admin_consulte`), igual aos toggles de despacho/dry-run. Sem alteração
  em `emails.ts` (a função já existia).

## Observações
- Atua junto com os toggles: a allowlist só tem efeito prático quando o **envio real** está ativo
  (dispatch ON + dry-run OFF). Em dry-run, nada sai de qualquer forma.
- Próximos sugeridos no backlog: **A2** (funil + taxas de bounce/complaint via RPC de agregação por tenant) e
  **A9** (catálogo/rótulos amigáveis de evento).

## Arquivos
`src/pages/gestao/EmailLogPage.tsx`, `src/lib/telemetry/core.ts`, `public/sw.js`, `SOURCE_VERSION.md`,
`docs/CHANGELOG-v110.md`.
