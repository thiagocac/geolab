# v77 — Reconciliação: modernização (v60→v74) + "v72 modais" + domínio (v52)

Release **UNIFICADA** que junta as duas trilhas que forkavam no v71:
- **A (minha modernização v60→v74):** Tailwind v4/OKLCH, Base UI (ConfirmDialog/Drawer/Modal/Tooltip/⌘K), RHF+Zod,
  TanStack Table+Virtual, Recharts, página dedicada (C), auditoria.
- **B ("v72 modais"):** Modal com corpo rolável (head/body/foot) + `Field` min-w-0 + grids nas telas de cadastro.
- **C (domínio v52):** app.concresoft.io.
Base = **meu v74 (superset)** + re-aplicada a B (do doc `GEOLAB-Revisao-Modais-Cadastro-v72.md`) + domínio. Gate verde.
**v77 ⊇ v76** (v76 = v71+modais; v77 = v71 + Recharts/auditoria + modais). Use o **completo** como árvore canônica.

## O que a "v72 modais" trouxe (re-aplicado sobre o v74)
- `src/components/ui/Modal.tsx` — Base UI Dialog com `.bui-modal-head` (fixo) / `-body` (rolável) / `-foot` (fixo) —
  resolve o "cursor sai da tela" em formulário alto; **mantém z-index 71 + a transição do meu v66**.
- `src/styles.css` — bloco `.bui-modal*` da v72 (flex-column, max-h min(90vh,760px), overflow hidden, head/body/foot,
  `.bui-modal-wide` 768→**860px**); **TODO o resto do styles.css preservado** (OKLCH/slate/motion/cmdk/vt/tooltip/backdrop-top…).
- `src/components/ui/Field.tsx` — `min-w-0` nas labels (inputs encolhem em grid/flex; **mantém a prop `error` do v65**).
- `src/pages/cadastros/ColaboradoresPage.tsx` — CPF/Registro → grid auto-fit (mantém `useConfirm`).
- `src/pages/cadastros/MateriaisPage.tsx` — removido o `×` duplicado (mantém `useConfirm`).
- `src/pages/operacao/OperacaoPage.tsx` — Cargo/Telefone + Slug/CNPJ → grid auto-fit.
- `src/pages/portal/ClienteUsuariosPage.tsx` — senha cresce (`flex-1 min-w-0`), botão "Gerar" fixo.

## Domínio (v52)
- `src/pages/ValidarPage.tsx` — `lab.consultegeo.org` → `app.concresoft.io`.

## `core.ts` / `public/sw.js` — v77.

## Sem dep nova. Só `git pull` + deploy. (Deps das fases anteriores — base-ui/rhf/tanstack/recharts — já no completo; `npm install`.)

## Conflitos resolvidos (ref. GEOLAB-Reconciliacao-Trilhas-2026-06-25.md)
- `Modal.tsx`: fiquei com a v72 (evolução do meu Modal). `styles.css`: troquei só o bloco `.bui-modal*`.
  `Field`/`Colaboradores`/`Materiais`: mesclados (v72 + meu `useConfirm`/`error`). `sw.js`/`core.ts`: renumerados → v77.
