# GEOLAB → Concresoft — SOURCE VERSION v51
CACHE_NAME: consultegeo-geolab-v51 · APP_VERSION: v51

## v51 — Biome (lint) no toolchain + gate (Fase 0 da modernizacao de frontend)
- Adiciona @biomejs/biome ^2.5.1 (devDep) + biome.json calibrado. Antes nao havia linter/formatter (so tsc + check-source).
- Postura lint-first: formatter e organizeImports DESLIGADOS (sem reformatacao/diff cosmetico).
  Regras estilisticas/intencionais OFF (useTemplate, noNonNullAssertion, noExplicitAny, noArrayIndexKey,
  noUnknownAtRules p/ @tailwind, noImportantStyles). a11y/hooks de baixo volume como warning.
- Corrigidos achados reais (erro): imports nao usados (validar.ts, telemetry/index.ts, ConcretagemDetalhePage),
  variaveis nao usadas (NcPage, RompimentosPage), let->const (rompimento.ts), escape inutil em regex (nc.ts),
  isFinite->Number.isFinite (concretagem/rompimento/Preferencias — todos sobre Number(...), sem mudanca de
  comportamento), type="button" em 6 botoes (Layout, Medicao, TenantSelection).
- Gate de build: check-source && biome lint src && tsc --noEmit && vitest run && vite build. Script novo: npm run lint.
- Sem mudanca visual, sem backend. Bump => v51. npm run build verde no sandbox.
