# v64 — Cadastro em Drawer lateral (padrão A) · Fase 3 (2/n)

Aplica o **padrão de cadastro aprovado**: o modal central branco do `AdminListPage` vira um **DRAWER LATERAL**
(desliza da direita, mantém a lista visível) usando o **Base UI Dialog** (foco preso, Escape, scroll-lock e
ARIA corretos). Como o `AdminListPage` é o pattern **compartilhado**, **todos os cadastros** (clientes, obras,
contatos, equipamentos, materiais, etc.) ganham o drawer de uma vez. Gate completo verde.

## Arquivos alterados (sobrescrever no repo)
- **NOVO** `src/components/ui/Drawer.tsx` — Base UI Dialog como painel lateral; **API igual à do Modal**
  (`open/title/onClose/children/footer/wide`), então a troca no AdminListPage foi 1:1
- `src/styles.css` — `.bui-drawer` (+ `-head`/`-body`/`-foot`; slide via `data-starting/ending-style`;
  reusa o `.bui-backdrop` do v63). 460px (wide 680px), full-width no mobile, corpo rola e cabeçalho/rodapé fixos
- `src/components/patterns/AdminListPage.tsx` — `<Modal>` → `<Drawer>` (só o container muda; render dos
  campos, lookup fiscal e save são idênticos)
- `core.ts` / `public/sw.js` / `SOURCE_VERSION.md`

## Notas
- **Sem dep nova** (o Base UI veio no v63) — só `git pull` + deploy.
- `Modal.tsx` **continua** (ainda usado por `NovaNcModal`, `ConcretagemDetalhe`, etc.) — não foi removido.
  Outros usos podem migrar p/ Drawer (curto/médio) ou virar página (longo) incrementalmente.

## Próximo (v65)
- **RHF + Zod** na validação do `AdminListPage` (esquema por `FieldSpec`, erro por campo, bloqueia submit inválido).
- Depois: **página dedicada (padrão C)** p/ o form longo (Nova Programação) + Popover/Select/Tabs/Tooltip do Base UI.
