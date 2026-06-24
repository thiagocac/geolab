# Patches v53 — React 18.3 -> 19.2 (Fase 1, conservador)

Aplicar por cima da v52, commitar, deixar o Netlify buildar.
IMPORTANTE: package.json + package-lock.json mudaram (React 19). `npm ci` no Netlify instala 19.2.x.

## Arquivos (7)
- package.json              (react/react-dom ^19; @types/react(-dom) ^19; react-router-dom ^6.28)
- package-lock.json         (react 19.2.7, react-dom 19.2.7, react-router-dom 6.30.4, @types/react 19.2.17)
- vite.config.ts            (manualChunks forma-funcao; re-separa React no chunk vendor)
- src/lib/telemetry/core.ts (APP_VERSION = 'v53')
- public/sw.js              (CACHE_NAME = 'consultegeo-geolab-v53')
- SOURCE_VERSION.md / INSTRUCOES.md

## O que muda
- Runtime React 19.2. NENHUMA mudanca de codigo de componente foi necessaria (o app ja era compativel:
  createRoot+StrictMode, sem padroes removidos no React 19). RR mantido na API v6 (subiu p/ 6.30.4).
- vite.config: o manualChunks virou funcao porque a forma-objeto nao captura mais o react-dom 19 — sem
  isso o React vazaria p/ o chunk index. Com a correcao: vendor ~193kB (React, cacheavel a parte), index ~54kB.
- React Compiler NAO entrou aqui (vem no v54, isolado).

## Validacao (sandbox) — gate completo
- npm run build => check-source OK · biome lint 0 erros · tsc 0 erros (com @types/react 19) · vitest 1/1 ·
  vite build OK (vendor 193kB / index 54kB) · EXIT 0.

## Risco/rollback
- Baixo (upgrade limpo, 0 erro de tipo). Rollback = reverter package.json/package-lock.json/vite.config.ts.

Bump: APP_VERSION/CACHE_NAME = v53.
