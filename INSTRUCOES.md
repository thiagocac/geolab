# v60 — Migração para Tailwind CSS v4 (fundação de tokens OKLCH) · Fase 2 (1/n)

PR de **fundação** da Fase 2. Troca o engine Tailwind **3 → 4** (CSS-first) e introduz a camada `@theme`
com os tokens de marca em **OKLCH**. **Paridade visual**: os neutros continuam no `slate` do Tailwind
(que o v4 já entrega em OKLCH); a única mudança visível é o **gradiente de marca**, que passa a
interpolar em OKLCH (mais vivo, sem a zona acinzentada do sRGB). Gate completo verde
(`check-source → biome → tsc → vitest → vite build`), React Compiler ativo.

## Arquivos alterados (sobrescrever no repo)
- `package.json` — + `tailwindcss@^4.3.0`, `@tailwindcss/postcss@^4.3.0`; − `tailwindcss@3`, `autoprefixer`
- `package-lock.json` — idem
- `postcss.config.js` — plugin `@tailwindcss/postcss` (sem autoprefixer; o v4 já prefixa via Lightning CSS)
- `src/styles.css` — `@import "tailwindcss"` + `@custom-variant dark` + bloco `@theme` (tokens OKLCH:
  navy/purple/magenta + rampa magenta + fontes + raios) + `@source` + shims de compat v3→v4 +
  gradiente de marca em OKLCH
- `biome.json` — exclui CSS do lint (`!src/**/*.css`); as at-rules do Tailwind v4 não são do escopo do Biome
- `src/lib/telemetry/core.ts` — `APP_VERSION = 'v60'`
- `public/sw.js` — `CACHE_NAME = 'consultegeo-geolab-v60'`
- `SOURCE_VERSION.md` — marcador

## AÇÃO MANUAL (o zip não representa exclusão)
- **APAGAR `tailwind.config.js`** do repo. No v4 a config é CSS-first; nada importa esse arquivo.

## Depois do pull
- `npm install` (novas deps). O Netlify builda normalmente — sem mudança no comando de build.

## Por que escolhi `@tailwindcss/postcss` (e não o plugin Vite)
- Integração agnóstica ao bundler: evita o edge case documentado do `@tailwindcss/vite` com
  rolldown-vite (Vite 8). Roda no pipeline PostCSS que o Vite já usa para CSS.

## Compat v3→v4 embutida nos shims (preserva paridade)
- `border` nu agora usa `var(--line)` (antes era `gray-200` fixo) — melhora o dark mode.
- `button`/`[role=button]` mantêm `cursor:pointer` (o v4 passa a `default`).
- `::placeholder` mantém `var(--ink-faint)`.

## Próximo (v61 — aplicação ampla, já com tokens aprovados)
- Migrar os utilitários `slate` → escala neutra **navy-tinted** + **papel morno** (a virada de paleta).
- Aplicar a escala tipográfica Mona Sans (eixo de largura no display).
- Motion completo: View Transitions de rota/lista + hover-lift + skeletons (respeitando `prefers-reduced-motion`).
