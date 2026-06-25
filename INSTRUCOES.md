# v71 — TanStack Table + Virtual: grid virtualizado e ordenável (isolado) · Fase 4 (3/n)

Introduz **TanStack Table** (headless) + **TanStack Virtual** (virtualização de linhas) num primitivo reusável
`VirtualTable`, aplicado de forma **ISOLADA** na lista da `ProgramacoesPage` (read-only, sem o risco do grid
editável de rompimentos). Ordenação por cabeçalho + render só das linhas visíveis (escala p/ centenas de linhas). Gate verde.

## Deps novas
- `+ @tanstack/react-table@^8` (8.21.3) `+ @tanstack/react-virtual@^3` (3.14.3). Peers React 19 ok.
- **Após o pull: `npm install`.**

## Arquivos alterados (sobrescrever no repo)
- **NOVO** `src/components/ui/VirtualTable.tsx` — primitivo genérico `<VirtualTable data columns rowId height/>`:
  TanStack Table (`getCoreRowModel`+`getSortedRowModel`, sorting por estado) + `useVirtualizer` (medição
  **dinâmica de altura** via `measureElement`, overscan). Markup em **divs** (a virtualização por `translateY`
  quebra o `<table>` nativo) — cabeçalho sticky e sortável, linhas absolutas.
- `src/pages/concreto/ProgramacoesPage.tsx` — a `<table>` manual virou `<VirtualTable>` com `ColumnDef[]`
  (status/data/cliente-obra/local/traço/fornecedor/volume **ordenáveis** + coluna Ações). Altura adapta ao nº de linhas (cap 620).
- `src/styles.css` — `.vt-*` (scroll, head sticky, tr absoluta, td).
- `core.ts` / `public/sw.js` / `SOURCE_VERSION.md`.

## Por que isolado AQUI (não no rompimentos)
- Grid **read-only e que eu controlo** (reescrito no v67) → baixo risco. Prova o padrão TanStack Table+Virtual.
  O grid **editável** de rompimentos (crítico) pode adotar o `VirtualTable` depois, com você validando no preview do Netlify.

## UX
- **Clique nos cabeçalhos para ordenar** (↑/↓). Listas longas renderizam só o visível (scroll suave).
- Cabeçalho fixo no topo; rolagem horizontal no mobile (colunas com largura fixa).

## Próximo
- Aplicar o `VirtualTable` a outras listas longas (concretagens/laudos) e, com cuidado e validação, ao grid de rompimentos.
