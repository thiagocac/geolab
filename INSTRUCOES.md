# INSTRUÇÕES — Release v89 (helper de exportação Excel + consolida v88 do laudo)

## ATENÇÃO — numeração e base
Árvore parte do source **v83** (mais recente NA PASTA). A memória indica v84–v87 feitos (portal/comentários/NF-OCR)
cujos fontes NÃO estão na pasta. Numerei **v89** e **consolidei o v88** (laudo) aqui. Os deltas são cirúrgicos →
**cherry-pick os arquivos abaixo sobre o HEAD atual** do repo. Descarte os zips `...-v84...` e `...-v88...` (numeração colidiu / superseded).

## Vai pro GitHub (patches → Netlify CI). Arquivos:
NOVOS (adições puras, sem conflito):
- src/lib/export/xlsx.ts                 → helper único de exportação Excel (xlsx-js-style)
- src/types/xlsx-js-style.d.ts           → tipos (reusa os do xlsx)

EXPORTS migrados p/ o helper:
- src/lib/portal/resultados.ts           → portal: 2 abas (Resumo por exemplar + Detalhe por CP)
- src/pages/gestao/ProdutividadePage.tsx → produtividade (TOTAL)
- src/pages/gestao/MedicaoPage.tsx       → medição (money/TOTAL)
- src/pages/concreto/RompimentosPage.tsx → modelo de rompimentos (modo `template`, round-trip) + leitura via xlsx-js-style

DEPENDÊNCIA:
- package.json + package-lock.json        → + "xlsx-js-style": "^1.2.0" (resolvido via --package-lock-only; npm ci ok)

VERSÃO:
- public/sw.js / src/lib/telemetry/core.ts → bump v89 (ajuste se o HEAD já estiver acima)
- SOURCE_VERSION.md                        → changelog v89

CONSOLIDADO do v88 (laudo — EF JÁ LIVE via MCP):
- src/lib/concreto/camposEnsaioLaudo.ts    → toggle "Bloco de aceitação" em CAMPOS_LAUDO
- supabase/functions/generate-laudo-ensaio-pdf/index.ts → paridade da EF v15 (sha 3242a328, já no ar)

> Se algum desses arquivos também mudou em v84–v87, reaplique a mudança (são cirúrgicas) em vez de sobrescrever.

## Como usar o helper (qualquer planilha nova)
import { exportExcel } from '../lib/export/xlsx';  (ajuste o caminho)
await exportExcel(
  { title: 'Meu relatório', subtitle: 'Laboratório X', fields: [{ label: 'Período', value: '01/06 a 30/06' }] },
  { name: 'Aba', totals: true, columns: [
      { key: 'nome', header: 'Nome', width: 28 },
      { key: 'valor', header: 'Valor', format: 'money', total: 'sum' },
      { key: 'data', header: 'Data', format: 'date' },
  ], rows: minhasLinhas },
);
Formatos: text | int | dec1 | dec2 | money | percent | date | datetime. Para MODELO reimportável use `template: true`
(cabeçalho na linha 1, sem banda). Detalhes/decisões em GEOLAB-Export-Excel-DS.md.

## Gate
check-source OK; helper passou tsc --noEmit (strict) isolado; 5 arquivos passaram syntax-check (esbuild). tsc/biome/vitest/vite no Netlify CI.
