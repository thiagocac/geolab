# Patches v51 — Biome (lint) no toolchain + gate de build

Aplicar por cima da v50, commitar, deixar o Netlify buildar.
IMPORTANTE: inclui package.json + package-lock.json (nova devDep @biomejs/biome). `npm ci` no Netlify instala a dep.

## Arquivos (19)
NOVO:
- biome.json                                     (config calibrada; formatter/organizeImports OFF)
ALTERADOS:
- package.json                                   (+devDep biome; script "lint"; gate inclui "biome lint src")
- package-lock.json                              (biome 2.5.1)
- src/lib/telemetry/core.ts                      (APP_VERSION = 'v51')
- public/sw.js                                   (CACHE_NAME = 'consultegeo-geolab-v51')
- src/lib/api/validar.ts                         (remove import nao usado: supabase)
- src/lib/telemetry/index.ts                     (remove imports nao usados: captureException, currentTraceId)
- src/pages/concreto/ConcretagemDetalhePage.tsx  (remove import nao usado: EmptyState)
- src/pages/concreto/NcPage.tsx                  (remove const toast nao usado — 1a ocorrencia)
- src/pages/concreto/RompimentosPage.tsx         (remove useMemo idsFiltrados nao usado)
- src/lib/api/concretagem.ts                     (isFinite -> Number.isFinite)
- src/lib/api/rompimento.ts                      (isFinite -> Number.isFinite; let -> const)
- src/pages/gestao/PreferenciasPage.tsx          (isFinite -> Number.isFinite)
- src/lib/api/nc.ts                              (escape inutil em regex)
- src/components/Layout.tsx                       (type="button" em 4 botoes)
- src/pages/gestao/MedicaoPage.tsx               (type="button" em 1 botao)
- src/pages/TenantSelectionPage.tsx              (type="button" em 1 botao)
- SOURCE_VERSION.md / INSTRUCOES.md

## O que muda
- Passa a existir lint (Biome) e o gate de build roda `biome lint src` (entre check-source e tsc).
- Lint-first: formatter e organizacao de imports DESLIGADOS — nenhum reformat/diff cosmetico.
  So bugs reais corrigidos (imports/vars mortos, isFinite, type de botao). Sem mudanca visual.
- Debt deixado de proposito como warning/info (NAO bloqueia): noExplicitAny (70), useTemplate (113),
  onClick em <div> (a11y), useExhaustiveDependencies. Tratar em PR dedicado depois.

## Validacao ja executada (sandbox) — gate completo
- npm run build => check-source OK · biome lint 0 erros (7 warn/1 info) · tsc 0 erros · vitest 1/1 · vite build OK · EXIT 0.

## Reverter o gate (caso queira o lint nao-bloqueante)
- Em package.json, script "build": remova " biome lint src &&". O `npm run lint` segue disponivel manual.

Bump: este patch ja vem com APP_VERSION/CACHE_NAME = v51.
