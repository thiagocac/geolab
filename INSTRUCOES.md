# v4 — Concretagem (central + programacao + caminhoes/CPs + ficha PDF)

## O que entra
- Central de Concretagens: lista (cliente/obra/fornecedor/status) + Nova concretagem (cliente/obra/traco/fornecedor/data/fck/local).
- Detalhe: dados + caminhoes; Adicionar caminhao (NF/placa/volume/slump/temp) gera amostra + CPs pelo padrao de moldagem do traco (default: 2 CP de 28 dias).
- Gerar ficha PDF -> invoca a EF generate-ficha-moldagem-pdf com o JWT da sessao.
- Rotas /concretagens e /concretagens/:id + navegacao.

## Arquivos a commitar (desde v3)
- src/lib/api/concretagem.ts (novo)
- src/pages/concreto/ConcretagensPage.tsx, ConcretagemDetalhePage.tsx (novos)
- src/App.tsx, src/components/Layout.tsx (alterados)
- public/sw.js (v4), src/lib/telemetry/core.ts (v4)
- SOURCE_VERSION.md, docs/release-v4.md

## Backend — JA APLICADO via MCP. A geracao de CP le operational_materials.padrao_moldagem (jsonb); sem padrao usa default NBR 5739.

## Gate: CACHE = APP_VERSION = v4. check-source OK no sandbox. tsc/vitest/vite no CI.

## Smoke pos-deploy
1. Concretagens -> Nova -> cliente/obra/traco/fornecedor/data -> Salvar.
2. Abrir -> Adicionar caminhao (NF + slump) -> Salvar (gera amostra + CPs).
3. Gerar ficha PDF -> baixa o PDF com caminhoes e CPs.
