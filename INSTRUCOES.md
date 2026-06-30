# INSTRUÇÕES — Patch v135 (delegação ligada à aprovação de laudo)

Patch **cumulativo** sobre v134. Copiar por cima do source e dar push (GitHub → Netlify CI).
(Se houver releases paralelas mais novas que v134 na pasta, prefira o **completo-v135** como base.)

## Arquivos do patch (frontend)
- `public/sw.js` · `src/lib/telemetry/core.ts`        — bump v135
- `src/lib/api/delegacoes.ts`                         — temDelegacaoAprovacao()
- `src/pages/concreto/LaudosPage.tsx`                 — botão Emitir por delegação + banner
- `SOURCE_VERSION.md` · `docs/CHANGELOG-v135.md`

## Backend (já aplicado via MCP — sem ação no push)
- Migration **112** aplicada. Referência em `docs/112_aprovar_laudo_aceita_delegacao.sql`.

## Gate (rodado nesta sessão): check-source OK · tsc 0 erros · vitest 23/23 · vite build OK
