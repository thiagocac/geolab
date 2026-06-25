# v68 — Tooltip do Base UI nos botões de ícone (fecha os primitivos da Fase 3) · Fase 3 (6/6)

Fecha a adoção de primitivos da Fase 3 **onde agrega**: Tooltip acessível do Base UI nos botões só-ícone da
topbar (menu, tema claro/escuro, sair), que antes tinham só `aria-label`. Hover/foco mostram o rótulo. Gate verde.

## Arquivos alterados (sobrescrever no repo)
- **NOVO** `src/components/ui/Tooltip.tsx` — wrapper Base UI (`Tooltip.Root/Trigger/Portal/Positioner/Popup`);
  usa o **render prop** → não adiciona DOM ao redor do botão (preserva o layout do `.theme-toggle`)
- `src/components/Layout.tsx` — 4 botões de ícone envolvidos em `<Tooltip label="...">`
- `src/styles.css` — `.bui-tooltip` (+ `-pos` z-75; popup escuro, transição)
- `core.ts` / `public/sw.js` / `SOURCE_VERSION.md`

## Decisões de escopo (onde NÃO apliquei, de propósito)
- **Select/Combobox** do Base UI: os `<select>` nativos já são acessíveis e funcionam; troca em massa do
  `SelectField` = alto churn/risco p/ ganho marginal → adiado (faço pontual se surgir lista longa que peça busca).
- **Tabs**: não há UI de abas hoje → sem alvo.
- **Popover**: "Notificações" é item de nav (não dropdown na topbar) → sem alvo claro agora.

## Sem dep nova (Base UI veio no v63) → só `git pull` + deploy.

## FASE 3 COMPLETA
- v63 ConfirmDialog · v64 Drawer (A) · v65 RHF+Zod · v66 Modal→Base UI Dialog · v67 Página dedicada (C) · v68 Tooltip.
- **Próximo: FASE 4** — TanStack Table + virtualização nos grids de lançamento, ⌘K, edição em massa com colar.
