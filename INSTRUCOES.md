# INSTRUÇÕES — Patch v80 (Portal do cliente: abas, filtros, Parcial/Final, resultados inline, Excel)

## Já aplicado por mim via MCP (NÃO precisa fazer nada no Supabase)
- **Migration 063** `063_portal_resultados_parcial_final` — aplicada em `xbdvyvvxvzmcosnekmfv` (aditiva, idempotente).
- **EF `lab-client-portal` v8** — deployada (sha `b9c4035d…`, era `a6355022…`). verify_jwt=false (inalterado).

## O que VOCÊ faz (frontend → GitHub → Netlify CI)
Commitar os arquivos abaixo no repo do GEOLAB e dar push. O Netlify builda e publica (app.concresoft.io).

### Arquivos novos
- `src/lib/portal/types.ts`
- `src/lib/portal/resultados.ts`
- `src/components/portal/ParcialFinalBadge.tsx`
- `src/components/portal/LaudosResultadosPanel.tsx`
- `src/lib/api/portalResultados.ts`
- `src/pages/portal/PortalPublicoPage.tsx`
- `supabase/migrations/063_portal_resultados_parcial_final.sql`  (referência; já aplicada)
- `supabase/functions/lab-client-portal/index.ts`  (referência; já deployada)

### Arquivos alterados
- `src/lib/api/clientUsers.ts`  (+ `criarLinkPortal`)
- `src/pages/portal/ClientePortalPage.tsx`  (abas Programação / Resultados & Laudos)
- `src/pages/portal/ClienteUsuariosPage.tsx`  (card "Acesso por link (sem senha)")
- `src/App.tsx`  (rota pública `/portal/acesso/:token`, fora do gate de auth)
- `src/lib/telemetry/core.ts`  (APP_VERSION v80)
- `public/sw.js`  (CACHE_NAME consultegeo-geolab-v80)

## Como o cliente usa
- **Login do cliente** → `/portal-cliente` → aba **Resultados & Laudos** (filtros, selo Parcial/Final, Ver resultados, Exportar Excel).
- **Sem login (magic link):** em **Operação ▸ Usuários de clientes**, card "Acesso por link" → selecione o cliente → "Gerar link do portal" (copia a URL `…/portal/acesso/<token>`, válida 30 dias, somente leitura).

## Regra Parcial/Final (por exemplar)
Final = TODOS os exemplares (NF) cobertos pelo laudo têm resultado na **idade de controle** (default 28d; idades menores = acompanhamento). Senão Parcial. `sem_resultados` = laudo sem resultado vinculado.

## Gate
`check-source` passou no sandbox. `tsc/biome/vitest` rodam no Netlify CI (sandbox sem node_modules). Revisão de código independente: SHIP.
