# Patches v55 — rolldown-vite 7.3.1 (bundler Rust, ponte p/ Vite 8)

Aplicar por cima da v54, commitar, deixar o Netlify buildar.
IMPORTANTE: package.json + package-lock.json mudaram. `npm ci` instala rolldown-vite 7.3.1
(+ um vite 5.4.21 aninhado para o vitest — esperado, nao e erro).

## Arquivos (6)
- package.json              ("vite": "npm:rolldown-vite@^7.3.1")
- package-lock.json
- src/lib/telemetry/core.ts (APP_VERSION = 'v55')
- public/sw.js              (CACHE_NAME = 'consultegeo-geolab-v55')
- SOURCE_VERSION.md / INSTRUCOES.md

## O que muda
- O bundler passa de Rollup/esbuild (Vite 5) para Rolldown/Oxc (Rust), via o pacote-ponte rolldown-vite.
  Config e plugins ficam IGUAIS (drop-in). E o passo recomendado antes do Vite 8.
- vitest continua no proprio vite 5.4.21 (npm resolveu o peer) — build em Rolldown, testes em vite 5.
  Sera unificado quando subirmos Vite 8 + vitest 3.
- React Compiler (v54) intacto — roda no transform do plugin-react; o bundler nao interfere.

## Validacao (sandbox)
- npm run build => check-source OK · biome lint 0 erros · tsc 0 erros · vitest 1/1 · vite build (Rolldown) OK · EXIT 0.
- Compiler confirmado sob Rolldown: 815 memo-slots $[n] no chunk index.
- Chunks: vendor ~182kB (React), supabase ~202kB, xlsx ~425kB isolado (lazy), paginas separadas.

## Verificar no Deploy Preview
- App identico; conferir que o build do Netlify roda (1a vez com Rolldown) e o tempo de build.

## Rollback
- Voltar package.json "vite" para "^5.4.1" e restaurar o package-lock.

Bump: APP_VERSION/CACHE_NAME = v55.
