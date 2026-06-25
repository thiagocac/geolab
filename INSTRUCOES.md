# v69 — ⌘K Command Palette (início da FASE 4) · Fase 4 (1/n)

Primeiro PR da Fase 4: **paleta de comandos global (Ctrl/Cmd+K)** para navegar e disparar ações rápidas.
Additivo (não refatora grids). **Sem `cmdk`** (que puxa Radix, evitado no projeto) — feito sobre o **Base UI
Dialog** que já temos, com filtro + navegação por teclado (↑↓ / Enter / Esc). Gate verde.

## Arquivos alterados (sobrescrever no repo)
- **NOVO** `src/components/ui/CommandPalette.tsx` — Base UI Dialog + input de filtro + lista filtrável;
  comandos `{id,label,group,run}`; atalho **⌘K** global; foco via ref+effect (sem `autoFocus`, que o Biome bloqueia)
- `src/components/Layout.tsx` — `useNavigate` + estado + **comandos derivados das seções de nav** (filtrados por
  papel via `hasRole`) + 2 ações (Nova programação, Nova obra) + botão **"Buscar ⌘K"** na topbar + `<CommandPalette/>`
- `src/styles.css` — `.cmdk-*` (popup top-center, item ativo, rodapé de atalhos) + `.topbar-search`
- `core.ts` / `public/sw.js` / `SOURCE_VERSION.md`

## UX
- **⌘K** (ou Ctrl+K) abre de qualquer tela; ou clique em **"Buscar ⌘K"** na topbar.
- Digite p/ filtrar (label + grupo); ↑↓ navega, Enter abre, Esc fecha. As navegações usam `viewTransition`.
- Os comandos **respeitam o papel** do usuário (mesma lista de nav da sidebar) + 2 ações de criação.

## Sem dep nova (Base UI veio no v63) → só `git pull` + deploy.

## Próximo (Fase 4)
- **TanStack Table + virtualização** nos grids de lançamento (rompimentos/resultados) + **edição em massa com colar**.
