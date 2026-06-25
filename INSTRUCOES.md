# v66 — Modal central migrado para Base UI Dialog (a11y) · Fase 3 (4/n)

Completa os primitivos de diálogo: o `Modal.tsx` passa a ser um **Base UI Dialog**, mantendo a **MESMA API**
(`open/title/onClose/children/footer/wide`) — então os **14 callers não mudaram uma linha**. Ganham foco
preso, scroll-lock, fundo inerte, ARIA correto e entrada/saída animada. Gate completo verde.

## Arquivos alterados (sobrescrever no repo)
- `src/components/ui/Modal.tsx` — reescrito sobre Base UI Dialog (`Dialog.Root`/`Portal`/`Backdrop`/`Popup`/`Title`); **API idêntica**
- `src/components/ui/ConfirmDialog.tsx` — backdrop passa a `.bui-backdrop-top` (z-90) p/ o confirm ficar **acima** de qualquer modal/drawer
- `src/styles.css` — `.bui-modal` (+ `-wide`; 480/768px, max-h 90vh, scroll), `.bui-backdrop-top` (z-90); confirm popup z-91
- `core.ts` / `public/sw.js` / `SOURCE_VERSION.md`

## Camadas de z-index (corretas agora)
- Modal/Drawer: backdrop z-70, popup z-71 · Toasts z-80 · **Confirm: backdrop z-90, popup z-91**
- → um confirm aberto sobre um modal/drawer aparece corretamente por cima.

## Sem dep nova, sem mudança de caller
- O Base UI veio no v63 → só `git pull` + deploy. Os 14 modais (Emitir fatura, Nova NC, Nova programação,
  auditoria/curva de CP, senha provisória, obras liberadas, numeração, etc.) ganham a11y **sem alterar o código deles**.
- Vale conferir no preview os modais "pesados": auditoria/curva de CP (RompimentosPage) e ConcretagemDetalhe.

## Próximo (v67)
- **Padrão C:** a "Nova programação" (form longo com a tabela de moldagem, hoje `<Modal wide>`) vira
  **PÁGINA DEDICADA** (rota própria, breadcrumb, deep-link, barra de ações fixa). + Popover/Select/Tabs/Tooltip do Base UI onde agregar.
