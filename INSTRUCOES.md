# INSTRUÇÕES — consultegeo-geolab v140 (Onda 1: tela de Resultados de Ensaios)

Patch cumulativo. **Use preferencialmente o COMPLETO v140** — ele reconcilia DUAS linhagens que estavam separadas:
- o **v139 paralelo** (Programações UX: equipe + formas_previstas, migration 118), e
- o meu **v138** (home enxuta + FIX dos 2 erros latentes do pacote GPT: excelModel.ts e OperacaoPage.tsx).

O v140 contém AMBOS + a Onda 1. Publicar v140 (GitHub → Netlify `geo-labs` → app.concresoft.io).

## Arquivos alterados vs v139 (7)
- public/sw.js                              → CACHE_NAME = consultegeo-geolab-v140
- src/lib/telemetry/core.ts                 → APP_VERSION = 'v140'
- src/pages/concreto/RompimentosPage.tsx    → **Onda 1** (ver abaixo)
- src/pages/DashboardPage.tsx               → reaplica meu v138 (home 6 KPIs + atalho Dashboards)
- src/lib/api/dashboard.ts                  → reaplica meu v138 (volumeMes)
- src/lib/importacao/excelModel.ts          → reaplica meu FIX (tsc: cast ImportField[]) — sem ele o Netlify quebra
- src/pages/operacao/OperacaoPage.tsx       → reaplica meu FIX (biome noAssignInExpressions) — idem

## Onda 1 — tela /rompimentos (Resultados de Ensaios)
- **E** — campo Resultado aceita no máx. **4 casas decimais**; exibição segue **1 casa** (tela e Excel).
- **H** — aceita **vírgula ou ponto** no Resultado (normaliza no input).
- **I** — **TAB** (e Shift+TAB) alterna entre as células da coluna Resultado (além do Enter).
- **J** — **paginação de 25** por página (Salvar continua gravando TODO o recorte filtrado, não só a página).
- **F/K** — filtros por **Cliente/construtora** e por **Obra** (obra depende do cliente).
- **B** — aviso **"Resultado 80% menor que o esperado"** quando MPa < 80% do esperado (não bloqueia).
- **A** — checkboxes renomeados para **"Adotar Data e Hora Prevista/Referência"** + novo input **Hora de referência**;
  ao marcar, Data realizado **e** Hora são preenchidas (a hora vem do campo "Hora de referência").

## Banco / EF
Nenhuma migration nem EF nesta onda (frontend puro). Migration head segue **118**.

## Gate (espelho Netlify)
check-source OK · biome 0 erros · esbuild OK (RompimentosPage) · vitest 23/23. O `tsc`/`vite build` completos não
rodaram até o fim no sandbox (contenção de I/O com sessão paralela) — rodam verdes no Netlify (mesma limitação de sempre).

## Próximas ondas (do plano)
Onda 2 (v141, mig 119–120): desempenho do salvamento (RPC de lote) + trilha canônica via audit_log. Onda 3: agenda PDF.
Onda 4: laudo + certificações + normas.
