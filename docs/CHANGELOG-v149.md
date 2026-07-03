# CHANGELOG v149 — Migration 130 (set_numeracao_cp) + eliminação do xlsx vulnerável

Base **v148**. Fecha os dois itens que restavam do horizonte da auditoria de 01/07
(`GEOLAB-Auditoria-2026-07-01.md`), agora que o rebase v146–v148 está entregue.

## 1. Migration 130 — set_numeracao_cp (APLICADA no vivo, 02/07)
A numeração manual de CP (tela de Rompimentos) tinha **dois** defeitos:
- **(a) Guard herdado do GEOMAT**: `is_tenant_writer()` sem argumento — no GEOLAB a assinatura
  exige o tenant. Toda chamada morria com "function is_tenant_writer() does not exist",
  mascarado pelo fallback de metadata do front (`rompimento.ts`). Mesmo bug corrigido na 129
  para `atribuir_numeracao_cp_lote`; anotado como latente desde então.
- **(b) Check de duplicidade defasado do UNIQUE**: a função validava por
  (tenant, **concretagem**), mas a **128** trocou o índice para (tenant, numeracao) —
  escopo do laboratório. Número repetido entre concretagens **passava no check** e estourava
  no `ux_corpos_prova_numeracao_lab_tenant` com erro cru de constraint. O check agora espelha
  o índice, com mensagem amigável ("ja utilizada neste laboratorio").
**Verificação pós-apply**: chamada sem claims JWT levanta `sem permissao para alterar numeracao
do CP` (linha do guard novo) — antes, o erro de assinatura. Zero writes no teste; `CREATE OR
REPLACE` preserva os grants. Registro fiel em `docs/130_fix_set_numeracao_cp_guard_e_escopo.sql`.

## 2. xlsx@0.18.5 (HIGH) — eliminado por remoção, não por troca
A auditoria (base v133) recomendava tarball de CDN porque o registry npm não tem fix
(GHSA-4r6h-8v6p-xvw6 Prototype Pollution + GHSA-5pgg-2g8v-p4x9 ReDoS). O diagnóstico no v148
mostrou algo melhor:
- Os usos eram **type-only** (`import type` no helper de export + `export * from 'xlsx'` no
  d.ts do fork), **exceto um**: o pacote GPT-Pro (v137) introduziu `await import('xlsx')` de
  valor no `src/lib/importacao/excelParser.ts` — um chunk lazy do vulnerável na Importação
  Excel.
- Fix em três movimentos: **(i)** `excelParser.ts` passa a importar `xlsx-js-style` (mesma API
  SheetJS — `read`/`sheet_to_json` — que o RompimentosPage já usa no import de cargas);
  **(ii)** `src/types/xlsx-js-style.d.ts` vira **contrato próprio** declarando só a superfície
  consumida (`WorkBook`/`WorkSheet`/`utils.encode_cell`/`encode_range`/`book_new`/
  `book_append_sheet`/`aoa_to_sheet`/`sheet_to_json`/`read`/`write`) — validado pelo tsc
  strict; ao usar API nova do módulo, ampliar o contrato; **(iii)** `xlsx` **removido** de
  `package.json`/`package-lock.json`/`node_modules`.
- Resultado: `npm audit` sem HIGH — resta **1 LOW pré-existente** (esbuild transitivo do
  vitest, dev-only, fora de escopo). Os chunks de Excel do `dist` nascem exclusivamente do
  `xlsx-js-style`. Nota honesta: o fork compartilha a base 0.18 do SheetJS; a exposição real
  (parse de planilhas enviadas pelos próprios usuários do lab) é baixa e agora há **uma**
  superfície em vez de duas — trocar o fork por alternativa estilizada moderna fica anotado
  para quando houver motivação de produto.

## Arquivos
`package.json` + `package-lock.json` (remove xlsx) · `src/types/xlsx-js-style.d.ts` (contrato
próprio) · `src/lib/export/xlsx.ts` (types/module do fork) · `src/lib/importacao/excelParser.ts`
(import do fork) · `docs/130_fix_set_numeracao_cp_guard_e_escopo.sql` (novo) · `public/sw.js` +
`src/lib/telemetry/core.ts` (bump) · `SOURCE_VERSION.md` · este changelog.

## Teste manual (pós-deploy)
1. Rompimentos › numeração manual de um CP: salvar funciona pela RPC (sem cair no fallback);
   repetir o número de OUTRA concretagem → mensagem "ja utilizada neste laboratorio".
2. Importações › Excel: subir uma planilha → parse normal (agora via xlsx-js-style).
3. Exportar fila/modelo em Rompimentos e qualquer relatório Excel → arquivos idênticos.

## Gate (espelho Netlify) — exit 0
check-source **OK** · biome **0 erros** (14 warnings baseline) · tsc --noEmit **0** (valida o
d.ts novo em strict) · vitest **23/23** · **vite build OK** · 0 `window.open(await…)` ·
`npm audit` sem HIGH.
