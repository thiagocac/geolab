# GEOLAB v46 — Fôrmas → Medição: cobrança automática

Conecta o controle de fôrmas ao faturamento. A `computar_medicao` **já somava** `forma_movimentacoes` de `tipo='cobranca'`, mas o CHECK da tabela só permitia `entrega`/`coleta` — então nunca casava (forma = sempre 0). Agora liberamos o evento de cobrança.

## Backend (migration 045, JÁ aplicada via MCP)
- `forma_movimentacoes.tipo` passa a aceitar **`cobranca`** (além de entrega/coleta). Nada mais muda: a `v_formas_saldo` já trata qualquer tipo ≠ entrega como −quantidade (cobrança **reduz o saldo**), e a `computar_medicao` já conta `sum(quantidade) where tipo='cobranca'` no período × preço da forma.
- Validado (atômico): entrega 10 → saldo 10; cobrança 4 → saldo 6; soma de cobrança no período = 4 (o que a medição fatura).

## Frontend (vai pro GitHub)
- src/pages/gestao/FormasPage.tsx — novo tipo **Cobrança (fôrma faturada / não devolvida)** no lançamento de movimento; render distinto (magenta, reduz saldo). Descrição da tela atualizada.
- public/sw.js + src/lib/telemetry/core.ts — bump **v46** (v45 foi backend-only EF → cache pulou v44→v46).

## Como usar
1. Em **Gestão → Fôrmas**, lançar um movimento **Cobrança** com a quantidade de fôrmas a faturar (não devolvidas/perdidas). Reduz o saldo da obra.
2. Em **Gestão → Medição**, ao calcular o período, a linha **"Formas (cobrança)"** já traz a quantidade somada × o preço de forma do escopo. Sem digitar nada.

## Passos
1. Subir o frontend no GitHub. Backend já aplicado.
2. Confirmar CACHE_NAME=`consultegeo-geolab-v46` / APP_VERSION=`v46`.

## Build
check-source OK · tsc(0) · vitest(1/1) · vite build OK.
