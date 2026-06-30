# INSTRUÇÕES — consultegeo-geolab v141 (Onda 2: desempenho do salvamento + trilha canônica)

**Use o COMPLETO v141** — cadeia cumulativa que carrega v138 (home + correções do pacote GPT) + v139 (Programações,
paralela) + v140 (Onda 1 rompimentos) + v141 (Onda 2). Publicar (GitHub → Netlify `geo-labs` → app.concresoft.io).

## Banco — JÁ aplicado no vivo via MCP (head agora 121)
- **119_lancar_rompimentos_lote_e_round4** — RPC `lancar_rompimentos_lote(payload jsonb)` que grava N CPs em UMA
  transação (reusa `lancar_rompimento_cp` no laço) e devolve as amostras abaixo do fck na idade de controle.
  Também: `lancar_rompimento_cp` passa a `round(.,4)` (banco guarda 4 casas; tela exibe 1).
- **120_cp_timeline_from_audit_log** — RPC `cp_timeline(cp_id)`: trilha do CP a partir do `audit_log` (CP + seus
  `material_tests`), no mesmo shape de `TimelineEvent`.
- **121_harden_revoke_anon_rompimento_rpcs** — revoga `anon` das 2 funções (paridade de segurança).

## Frontend (5 arquivos)
- public/sw.js · src/lib/telemetry/core.ts → bump **v141**
- src/lib/api/rompimento.ts        → `lancarRompimentosLote` + `notifyAbaixoFck`
- src/lib/api/timeline.ts          → `listCpTimeline`
- src/pages/concreto/RompimentosPage.tsx → **D**: "Salvar resultados" agora faz **1 RPC de lote** (em vez de N
  chamadas sequenciais + 2 SELECT por CP) e notifica abaixo-do-fck 1×/amostra. **C**: a "Trilha de alterações" lê o
  `audit_log` canônico (via `cp_timeline`) e renderiza com `TimelineList` — passa a registrar TODAS as alterações
  (lançamento, edição, situação, descarte), não só o último resultado.

## Gate (espelho Netlify)
check-source OK · biome 0 erros · **tsc --skipLibCheck 0 erros** (tipos do app validados) · vitest 23/23 · esbuild OK.
O `tsc`/`vite build` completos não fecham no sandbox (contenção de I/O com a sessão paralela) — rodam no Netlify.

## Próxima
Onda 3 (v142): refazer a Agenda PDF (visual da ficha + 2 colunas em branco; OCR ao backlog).
