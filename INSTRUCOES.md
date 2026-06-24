# Patches v52 — Versao na UI automatica

Aplicar por cima da v51, commitar, deixar o Netlify buildar.

## Arquivos (5)
- src/components/Layout.tsx       (rodape le APP_VERSION; remove "Concresoft v36" hardcoded)
- src/lib/telemetry/core.ts       (APP_VERSION = 'v52')
- public/sw.js                    (CACHE_NAME = 'consultegeo-geolab-v52')
- SOURCE_VERSION.md / INSTRUCOES.md

NAO vai no repo (doc de project-knowledge, atualizado direto na pasta do projeto): ds.md reescrito.

## O que muda
- O rodape da sidebar passa a exibir a versao real automaticamente (le APP_VERSION).
  Some a divergencia de versao hardcoded. Nenhuma outra mudanca visual/comportamental.

## Validacao (sandbox) — gate completo
- npm run build => check-source OK · biome lint 0 erros · tsc 0 erros · vitest 1/1 · vite build OK · EXIT 0.

Bump: APP_VERSION/CACHE_NAME = v52.
