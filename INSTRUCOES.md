# INSTRUÇÕES — Patch v137 (Dashboards + Contratos/Financeiro + Importação Excel — GPT Pro, re-baseado)

Patch **cumulativo** sobre v136. **Recomendado: use o `consultegeo-geolab-source-completo-v137.zip`** (re-baseado, à prova de buraco entre releases paralelas).

## Frontend (arquivos do patch)
- `public/sw.js` · `src/lib/telemetry/core.ts`            — bump v137
- `src/App.tsx` · `src/components/Layout.tsx`             — 3 rotas + 3 menus (Dashboards, Importação Excel, Contratos e financeiro)
- `src/lib/api/dashboards.ts` · `contractFinance.ts` · `excelImport.ts`
- `src/lib/importacao/excelModel.ts` · `excelTemplates.ts` · `excelParser.ts`
- `src/pages/dashboards/LabDashboardsPage.tsx`
- `src/pages/gestao/ContratosFinanceiroPage.tsx`
- `src/pages/concreto/ImportacaoExcelPage.tsx`
- `SOURCE_VERSION.md` · `docs/CHANGELOG-v137.md` · `docs/ANALISE-DASHBOARDS-REFERENCIA-v134.md`

## Backend (já aplicado via MCP — sem ação no push)
- Migrations **113-116** (renumeradas de 112-115 do GPT). Sem EFs. Referências em `docs/11{3,4,5,6}_gpt_v134_ref.sql`.

## Gate de build (rodado nesta sessão)
- `check-source` OK · `esbuild` OK (todos os arquivos) · **`vite build` OK** (gera o dist) · `vitest` **23/23**.
- `tsc --noEmit` completo: trava por I/O do ambiente local (.d.ts do recharts v3); roda normalmente no Netlify.
