# v62 — View Transitions de rota (escopadas ao conteúdo) · Fase 2 (3/n)

Fecha o "motion completo" da Fase 2 com **transições de rota** suaves. Usa o suporte **nativo do React
Router 6.30.4** (`viewTransition` na `NavLink`) — ele embrulha a navegação em `document.startViewTransition`
e cuida do `flushSync`/concurrent. A animação é **escopada só à área de conteúdo** (`.page-wrap` ganha
`view-transition-name:page-content`), então **sidebar e topbar ficam parados** — só o miolo faz um
fade + slide curto. Degrada sozinho: navegadores sem a API caem na navegação normal; `prefers-reduced-motion`
desliga a animação (o guard global zera as durações). Gate completo verde.

## Arquivos alterados (sobrescrever no repo)
- `src/components/Layout.tsx` — `viewTransition` na `<NavLink>` da sidebar (1 ponto cobre toda a navegação principal)
- `src/styles.css` — `.page-wrap{view-transition-name:page-content}` + `::view-transition-old/new(page-content)`
  com `@keyframes vt-out/vt-in` (fade + slide ~.2-.26s, `var(--ease-out)`), sob `prefers-reduced-motion:no-preference`
- `src/lib/telemetry/core.ts` / `public/sw.js` — v62
- `SOURCE_VERSION.md` — marcador

## Depois do pull
- Sem dep nova: `git pull` + deploy.

## Notas de escopo
- **viewTransition ligada na navegação da sidebar** (o caso principal: trocar de seção). Navegações dentro da
  página (linha→detalhe, atalhos do Painel via `useNavigate`) podem adotar a VT incrementalmente passando
  `{ viewTransition: true }` no `navigate(...)` — não fiz em massa pra manter o PR enxuto.
- **Hover-lift em cards interativos: não aplicado** — o app usa `<Button>` para ações e os cards de KPI (`Stat`)
  não são clicáveis; forçar lift em card estático é anti-padrão. A classe `.lift` (v61) fica disponível para quando
  surgir card clicável.

## Fase 2 — fechada
- v60 engine Tailwind v4 + @theme OKLCH · v61 virada de paleta + tipografia + skeletons/micro-motion · v62 View Transitions.
- **Próximo: Fase 3** (primitivos Base UI + drawer A/página C para cadastro + RHF+Zod + ConfirmDialog no lugar de window.confirm).
