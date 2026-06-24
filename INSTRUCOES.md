# GEOLAB v48 — Relatórios de produtividade

Produção por colaborador (moldador / operador de rompimento) num período.

## Backend (migration 046, JÁ aplicada via MCP)
- RPC **`relatorio_produtividade(inicio, fim)`** (SECURITY DEFINER, tenant-scoped). Por colaborador com atividade no período: **concretagens** moldadas (`concretagens.moldador_id`), **CPs moldados** (`corpos_prova` via concretagem do moldador), **rompimentos** realizados (`material_tests.operador_id`). Inclui `funcoes`. Validado contra o seed: 1 concretagem / 8 CPs / 12 rompimentos.

## Frontend (vai pro GitHub)
- src/lib/api/produtividade.ts (novo) + src/pages/gestao/ProdutividadePage.tsx (novo) — período + tabela por colaborador + total + **Exportar Excel**.
- src/App.tsx (rota /produtividade), src/components/Layout.tsx (nav "Produtividade", Gestão, admin/gestor).
- public/sw.js + src/lib/telemetry/core.ts — bump **v48**.

## Como usar
Gestão → Produtividade → escolher período → Calcular. Tabela por colaborador (concretagens, CPs moldados, rompimentos) + total; botão Exportar Excel.

## Passos
1. Subir o frontend no GitHub. Backend já aplicado.
2. Confirmar CACHE_NAME=`consultegeo-geolab-v48` / APP_VERSION=`v48`.

## Build
check-source OK · tsc(0) · vitest(1/1) · vite build OK.
