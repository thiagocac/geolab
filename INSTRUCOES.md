# v61 — Virada de paleta OKLCH (navy-tinted + papel morno) + tipografia editorial + motion · Fase 2 (2/n)

A **virada visível** da Fase 2. A paleta neutra passa para **OKLCH navy-tinted** via override do `slate`
no `@theme` (sem editar componentes), o fundo vira **papel morno**, os títulos ganham tratamento
**editorial** (Mona Sans com eixo de largura) e entram **skeletons** + **micro-motion** tokenizado.
Gate completo verde (`check-source → biome → tsc → vitest → vite build`), React Compiler ativo.

## Arquivos alterados (sobrescrever no repo)
- `src/styles.css` — override `--color-slate-*` (navy hue 262); `:root`/`.dark` neutros em OKLCH + **papel morno**;
  tokens de motion (`--dur-*`/`--ease-*`); shadows OKLCH; classes `.display`/`.skeleton`/`.lift`;
  transitions tokenizadas em `.btn`/`.card`/`.nav-link` + hover-lift no `.btn-primary`
- `src/components/ui/PageHeader.tsx` — título com `.display` (peso 720 + largura 110% editorial)
- `src/components/ui/Card.tsx` — `CardHeader` h2 com `.display`
- `src/components/ui/State.tsx` — `LoadingState` vira **skeleton shimmer**
- `src/lib/telemetry/core.ts` / `public/sw.js` — v61
- `SOURCE_VERSION.md` — marcador

## Depois do pull
- Sem dep nova: `git pull` + deploy. Netlify builda normal.

## O que olhar no preview do Netlify
- Fundo levemente **quente** (papel morno) atrás de cards brancos; neutros com viés navy sutil;
  **títulos mais largos/editoriais**; loading com **shimmer**; botão primário com leve **elevação no hover**.
  Tudo respeitando `prefers-reduced-motion`.

## Como o slate virou navy sem tocar telas
- As ~centenas de classes `*-slate-*` referenciam `var(--color-slate-N)`. Redefinindo `--color-slate-*`
  no `@theme`, toda a UI migrou de uma vez. As CSS vars (`--ink`/`--surface`/`--line`) foram alinhadas aos
  mesmos valores OKLCH, então utilitário e var concordam.

## Próximo (v62)
- **View Transitions** de rota/lista (nível de router, RR6 → PR isolado) + hover-lift aplicado a cards/itens
  interativos + escala tipográfica fina (tokens `--text-*`).
