# v63 — Base UI (primitivos acessíveis) + ConfirmDialog no lugar de window.confirm · Fase 3 (1/n)

Fundação da Fase 3: instala o **Base UI 1.6** (MUI — primitivos unstyled, acessíveis, **icon-agnóstico**) e
introduz o **ConfirmDialog** (AlertDialog do Base UI) que substitui **todos os 7 `window.confirm`** por um
diálogo com foco/teclado/ARIA corretos, estilizado nos tokens. Gate completo verde.

## Dep nova + override (IMPORTANTE para o install)
- `+ @base-ui/react@^1.6.0`
- `package.json` ganhou `overrides: { "@base-ui/react": { "date-fns": "$date-fns" } }` — o Base UI declara
  `date-fns@^4` como peer **opcional** (só p/ componentes de data, que NÃO usamos). O override aponta p/ o
  `date-fns@3.6.0` que já existe → evita `ERESOLVE` sem `legacy-peer-deps` global nem bumpar o date-fns.
- **Após o pull: `npm install`** (instala o Base UI + atualiza o lockfile). O Netlify resolve com o override.

## Arquivos alterados (sobrescrever no repo)
- **NOVO** `src/components/ui/ConfirmDialog.tsx` — `ConfirmProvider` + `useConfirm()` (retorna `Promise<boolean>`); AlertDialog do Base UI
- `src/main.tsx` — `<ConfirmProvider>` dentro do `<ToastProvider>`
- `src/styles.css` — `.bui-backdrop` / `.bui-popup` (overlays do Base UI; transição via `data-starting/ending-style`)
- 7 sites `window.confirm` → `await confirm({ title, message, danger, confirmLabel })`:
  `AdminListPage`, `Colaboradores`, `Materiais`, `Faturas`, `Formas`, `Lotes`, `NcPage` (no subcomponente `NcDetalhe`)
- `package.json` / `package-lock.json` / `core.ts` / `public/sw.js` / `SOURCE_VERSION.md`

## Padrão de uso daqui pra frente
- `const confirm = useConfirm();` (hook no corpo do componente)
- `if (!(await confirm({ title, message, danger: true, confirmLabel: 'Excluir' }))) return;`
- **Zero `window.confirm` no código** (dá pra adicionar uma regra no check-source proibindo, se quiser).

## Próximo (v64)
- Migrar o **modal central branco** do `AdminListPage` → **Drawer lateral (padrão A)** com Base UI Dialog
  (form curto/médio) + **RHF + Zod** na validação. Página dedicada (padrão C) p/ o form longo (Nova Programação) vem depois.
