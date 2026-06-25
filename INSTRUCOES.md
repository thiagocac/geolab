# v67 — Padrão C: "Nova programação" vira página dedicada · Fase 3 (5/n)

O formulário mais longo do sistema (**Nova programação de concretagem** — cliente/obra/traço/logística +
a tabela `MoldingStandardEditor`) sai do `<Modal wide>` e vira uma **PÁGINA DEDICADA** em `/programacoes/nova`
(padrão **C**): breadcrumb, deep-link, **barra de ações fixa no rodapé** (sticky) e transição de rota
(View Transitions). Fecha o padrão A/C (A=drawer p/ curto-médio, C=página p/ longo). Gate verde.

## Arquivos alterados (sobrescrever no repo)
- **NOVO** `src/pages/concreto/NovaProgramacaoPage.tsx` — a página do form (extraído do modal; **lógica idêntica**:
  queries de cliente/obra/traço/moldador, `salvar`, `MoldingStandardEditor`)
- `src/pages/concreto/ProgramacoesPage.tsx` — **enxuta**: só a lista + ações; o botão "Nova programação"
  navega p/ `/programacoes/nova` (`viewTransition`); removidos Modal + estado de form + queries do form
- `src/App.tsx` — lazy import + rota `/programacoes/nova`
- `src/styles.css` — `.form-actions` (barra sticky no rodapé do conteúdo)
- `core.ts` / `public/sw.js` / `SOURCE_VERSION.md`

## Notas
- **Sem dep nova** → só `git pull` + deploy.
- As navegações do fluxo (abrir/salvar/cancelar) usam `{ viewTransition: true }` → transição suave (a VT de rota do v62).
- Salvar continua indo p/ `/concretagens/:id` (a concretagem criada). Cancelar/breadcrumb voltam p/ `/programacoes`.

## GOTCHA de sandbox (não afeta o app)
- O `npm run build` inteiro estourou 45s no sandbox hoje (chain longa + contenção de processos presos).
  Validei o gate **em partes**: check-source OK · biome 0 erros · **tsc 0 erros** · vitest 18/18 · **vite build 7s**. Tudo verde.

## Fase 3 — padrão de cadastro COMPLETO
- **v63** ConfirmDialog · **v64** Drawer (A) · **v65** RHF+Zod · **v66** Modal→Base UI Dialog · **v67** Página dedicada (C).
- Próximo: Popover/Select/Tabs/Tooltip do Base UI onde agregar (filtros, seletor de obra) + polish.
