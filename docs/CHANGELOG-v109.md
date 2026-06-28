# CHANGELOG — v109 (Gestão de e-mails · A6 — gerenciar supressões)

**APP_VERSION:** v108 → **v109** · **CACHE_NAME:** consultegeo-geolab-v108 → **…-v109**
**Build:** `npm run build` verde (check-source · biome · tsc · vitest 18/18 · vite).
**Migration:** 1 (migration 085 — duas funções de escrita; não cria tabela nem altera dados).

Segundo item do `docs/BACKLOG-FRONTEND-EMAILS.md` (após A1=v108). Dá visibilidade **e controle** sobre as
supressões de e-mail (endereços que pararam de receber por bounce/reclamação/manual).

## Migration — `085_email_suppression_write_rpcs.sql`
- `email_suppression_add(p_email text, p_reason text default 'manual')` — upsert (`on conflict (email)`),
  normaliza `lower(trim)`.
- `email_suppression_remove(p_email text)` — delete (reabilita o endereço).
- Ambas `language plpgsql security definer set search_path = public`, autorizadas por
  **`has_role('admin_consulte')`** (mesmo papel da policy de SELECT `sel_email_suppressions`). Caller sem o papel
  recebe `not authorized` (**verificado**: chamada em contexto de serviço foi recusada, 0 linhas inseridas).
  `revoke` de `public`/`anon`, `grant` a `authenticated`. Reversível (`drop function`).

## Frontend
- `src/lib/api/emails.ts` — `SuppressionRow` + `listSuppressions()` (leitura) e `addSuppression()`/
  `removeSuppression()` (escrita via RPC). `db` passou a expor `rpc`.
- `src/pages/gestao/EmailLogPage.tsx` — novo card **Supressões de e-mail**, renderizado **somente para
  `admin_consulte`** (`podeSupressao = hasRole('admin_consulte')`, alinhado à RLS de leitura):
  - **Formulário** para adicionar supressão manual (e-mail + motivo) com `Field`/`Button`.
  - Tabela com e-mail, motivo, data e botão **Remover** por linha (com `confirm`).
  - Estado vazio "caixa saudável"; mensagens de sucesso/erro; refetch via `supr.refetch()` (padrão da página).

## Observações
- Supressões são **globais por e-mail** (tabela sem `tenant_id`); por isso a gestão fica restrita ao papel
  interno `admin_consulte`. Um `admin` de laboratório (sem esse papel) não vê o card (e a RLS não o deixaria ler).
- Próximos sugeridos no backlog: **A7** (editor de allowlist — `saveDispatchSettings` já aceita o patch) e
  **A2** (funil + taxas de bounce/complaint via RPC de agregação).

## Arquivos
`src/lib/api/emails.ts`, `src/pages/gestao/EmailLogPage.tsx`, `src/lib/telemetry/core.ts`, `public/sw.js`,
`SOURCE_VERSION.md`, `docs/CHANGELOG-v109.md` + migration `supabase/migrations/085_email_suppression_write_rpcs.sql`.
