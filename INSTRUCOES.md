# v73 — Recharts na Observabilidade (séries temporais) · Fase 5 (2/n)

Leva o Recharts ao painel mais data-rich: substitui o **sparkline SVG feito à mão** dos Web Vitals por um
`MiniTrend` (área Recharts) e adiciona um **gráfico de barras p95 por Edge Function** (color-coded por limiar).
**Sem dep nova** (recharts veio no v72). Gate verde.

## Arquivos alterados (sobrescrever no repo)
- `src/pages/gestao/ObservabilidadePage.tsx`:
  - **REMOVIDO** o `Sparkline` SVG manual; **NOVO `MiniTrend`** (`ResponsiveContainer`+`AreaChart`; gradiente
    com **id único via `useId`** p/ não colidir entre as 5 métricas; `connectNulls`; cor parametrizável).
  - **NOVO card "Latência p95 por função (top)"**: `BarChart` horizontal dos top-10 EFs por p95, `Cell`
    color-coded (>1500ms vermelho, >600 âmbar, senão verde); eixos/tooltip via CSS vars (tema-aware).
- `core.ts` / `public/sw.js` / `SOURCE_VERSION.md`.

## Sem dep nova → só `git pull` + deploy. Recharts segue no chunk lazy `charts` (compartilhado com o Painel).

## Por que aqui
- A Observabilidade tem as séries reais (web-vitals p75/dia, p95 de EF) → é onde o Recharts agrega de verdade,
  trocando viz hand-rolled por uma lib testada.

## Próximo (Fase 5)
- **Storybook** dos primitivos · testes **axe** (vitest+axe-core) / **Playwright** E2E.
  (Ambos são **dev tooling** — ficam fora do bundle e do build do Netlify, com setup/uso próprios.)
