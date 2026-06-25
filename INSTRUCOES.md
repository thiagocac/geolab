# v70 — Edição em massa colando (paste-to-fill) no grid de rompimentos · Fase 4 (2/n)

A maior alavanca operacional da Fase 4 p/ o lab: **colar uma COLUNA do Excel** no campo de carga/MPa preenche
vários CPs consecutivos de uma vez. **Additivo** (não reescreve o grid). Gate verde.

## Por que NÃO o TanStack Table+Virtual agora (decisão consciente)
- A `RompimentosPage` é a tela mais crítica e intrincada do lab (448 linhas: estado de edição por CP,
  filtros, seleção/bulk, 4 modais, XLSX import/export, preservação E1<fck). Reescrever o grid p/
  TanStack Table+Virtual **num PR só = alto risco**, sem como testar visualmente daqui. O **paste-to-fill**
  entrega o maior ganho de workflow (lançar 20 cargas colando) **sem** o refactor. O grid-engine
  (TanStack Table+Virtual) fica p/ um esforço **isolado e testável** depois.

## Arquivos alterados (sobrescrever no repo)
- `src/pages/concreto/RompimentosPage.tsx` — `handlePaste(e, rowIndex)`: lê o clipboard, divide por linha,
  distribui aos CPs **consecutivos a partir da linha colada** (carga OU MPa, conforme o toggle `entrarCarga`);
  normaliza **vírgula→ponto**; ignora paste de valor único (deixa o paste normal do navegador). `onPaste`+`title`
  no input de carga; índice (`rowIdx`) no `.map` das linhas; hint no topo da tabela.
- `core.ts` / `public/sw.js` / `SOURCE_VERSION.md`

## UX
- No grid, **cole (Ctrl+V) uma coluna** de valores do Excel no campo de carga/MPa de qualquer linha → preenche
  daquela linha p/ baixo. Toast confirma quantos foram preenchidos. 1 valor só = paste normal. Vírgula vira ponto.

## Sem dep nova → só `git pull` + deploy.

## Próximo (Fase 4)
- **TanStack Table + virtualização** do grid (esforço isolado, testável no preview do Netlify), edição inline mais rica.
