# CHANGELOG v137 — Dashboards + Contratos/Financeiro + Importação Excel (GPT Pro, re-baseado)

> Pacote do GPT Pro (entregue como "v134"). Analisado, validado contra o banco vivo, **renumerado** e **re-baseado sobre o v136**.

## Banco — migrations 113-116 (aplicadas via MCP; TODAS as colunas referenciadas validadas no vivo)
- **113 dashboard_laboratorio_snapshot** — RPC agregadora (KPIs/séries/rankings). Sem novas tabelas.
- **114 contract_finance_core** — colunas financeiras aditivas em `lab_contracts` + tabelas `lab_contract_price_items`/`lab_contract_financial_events` + `upsert_contract_price_item` + `contract_finance_snapshot`.
- **115 excel_import_foundation** — tabelas `excel_import_batches`/`excel_import_rows` + `list_excel_import_batches` (RLS por tenant).
- **116 excel_import_commit_rpcs** — `commit_excel_import` (traços/concretagens/recebimentos/resultados; idempotente; dry-run).

## Frontend (re-baseado sobre v136)
- **/dashboards** — painéis (recharts): volume, qualidade, fornecedores, obras, financeiro, slump, curva de resistência, NC. Export Excel.
- **/gestao/contratos-financeiro** — KPIs (contratos/medido/faturado/recebido/aberto/vencido), recebíveis, séries; preços por escopo.
- **/importacoes/excel** — importação Excel dinâmica (modelo por recurso, validação no front, commit server-side).
- Libs: `dashboards.ts`, `contractFinance.ts`, `excelImport.ts`, `importacao/excel{Model,Templates,Parser}.ts`. Rotas + 3 menus.

## Ajustes/adaptações que fiz
- **Renumeração** das migrations 112-115 → 113-116 (meu head era 112 = aprovar_laudo+delegação).
- **Re-base** do frontend sobre o v136 (não o v133 do GPT): copiei só os 9 arquivos novos + as 3 rotas/menus, preservando timeline (v134)/delegação (v135)/docgate (v136).
- **Validação** de cada coluna referenciada pelas RPCs contra o vivo (lab_contracts, medicoes, faturas, material_tests/receipts, non_conformities) — todas existem.
- `sw.js`/`core.ts`: meu bump (v137).

## Verificação
- `check-source` OK · `esbuild` OK (9 arquivos + App + Layout) · **`vite build` OK** (gera o dist).
- `tsc --noEmit` completo: o ambiente local trava por I/O nos `.d.ts` (recharts v3); o gate do Netlify roda o tsc com I/O rápido.

CACHE_NAME=consultegeo-geolab-v137 · APP_VERSION=v137
