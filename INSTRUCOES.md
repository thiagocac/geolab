# INSTRUÇÕES — consultegeo-geolab v138

Patch cumulativo sobre o repositório (fork de `thiagocac/geomat`). Sobrescreva os arquivos abaixo,
faça commit e push. O Netlify CI (projeto `geo-labs`) builda e publica em https://app.concresoft.io.

## Arquivos deste patch (6)
- public/sw.js                          → bump CACHE_NAME = consultegeo-geolab-v138
- src/lib/telemetry/core.ts             → bump APP_VERSION = 'v138'
- src/lib/api/dashboard.ts              → KPIs da home + volume do mês (campo volumeMes)
- src/pages/DashboardPage.tsx           → home enxuta: 6 KPIs operacionais + atalho /dashboards
- src/lib/importacao/excelModel.ts      → FIX tsc: cast `as ImportField[]` após `.filter` (pacote GPT v137)
- src/pages/operacao/OperacaoPage.tsx   → FIX biome noAssignInExpressions (painel de permissões efetivas)

## Banco (JÁ aplicado no vivo via MCP)
- migration **117_dashboard_kpis_volume_mes** — estende a RPC `dashboard_kpis` com `volume_mes`
  (m³ do mês corrente; coalesce volume_lancado/programado, data_real/programada). Sem pasta
  supabase/migrations no repo de frontend; registrado aqui para rastreio.

## Gate (espelho do Netlify) — JÁ RODADO E VERDE
check-source OK · biome lint 0 erros · tsc --noEmit limpo · vitest 23/23 · vite build OK (VITE_DEMO_MODE=false)

## IMPORTANTE
O pacote GPT-Pro **v137** (Dashboards/Financeiro/Importação) tinha 2 erros que REPROVAVAM o gate do Netlify
(tipos em `excelModel.ts` e assign-in-expression em `OperacaoPage.tsx`). Ambos corrigidos aqui — publicar
**v138** (não v137) para o build passar. Bump de CACHE_NAME + APP_VERSION conferido pelo check-source.
