# Patches v56 — Vite 8 nativo + plugin-react v6 + vitest 3

Aplicar por cima da v55, commitar, deixar o Netlify buildar.
IMPORTANTE: package.json + package-lock.json mudaram bastante (Vite 8, plugin-react 6, vitest 3,
+@rolldown/plugin-babel, +@babel/core). `npm ci` instala tudo.

## Arquivos (8)
- package.json              (vite ^8; @vitejs/plugin-react ^6; vitest ^3; +@rolldown/plugin-babel ^0.2.3;
                             +@babel/core; +@types/babel__core; babel-plugin-react-compiler mantido)
- package-lock.json
- vite.config.ts            (compiler via @rolldown/plugin-babel + reactCompilerPreset; babel ANTES de react)
- tsconfig.json             (moduleResolution: 'bundler' — necessario p/ os tipos do Vite 8)
- src/lib/telemetry/core.ts (APP_VERSION = 'v56')
- public/sw.js              (CACHE_NAME = 'consultegeo-geolab-v56')
- SOURCE_VERSION.md / INSTRUCOES.md

## O que muda
- Bundler: Vite 8 nativo (Rolldown+Oxc), saindo do pacote-ponte rolldown-vite (v55). plugin-react v6 faz
  o JSX/refresh em Oxc (Rust) — dropou o Babel interno.
- React Compiler: como o v6 nao aceita mais react({babel}), o compiler volta via @rolldown/plugin-babel +
  reactCompilerPreset() (no `presets`), com babel() ANTES de react(). Continua memoizando (765 slots $[n]).
- vitest 3 unifica no vite 8 (a v55 tinha um vite 5 aninhado so para o vitest — resolvido).
- tsconfig moduleResolution 'bundler': os tipos do Vite 8 vem por exports maps; 'Node' (legado) nao resolve.
- Build mais RAPIDO (~5.6s) que v54/v55: Oxc no JSX, Babel so no compiler.

## Validacao (sandbox)
- npm run build => check-source OK · biome lint 0 erros (7 warn/1 info) · tsc 0 erros · vitest 1/1 (vite 8) ·
  vite build OK (vendor ~182kB) · EXIT 0.
- Compiler confirmado: 765 memo-slots $[n] no index + import de react/compiler-runtime.

## Verificar no Deploy Preview
- App identico; conferir o build do Netlify (1a vez em Vite 8) e o selo "Memo" no React DevTools.
- Nota: o build loga PLUGIN_TIMINGS do @rolldown/plugin-babel (o passo do compiler) — informativo.

## Rollback
- Reverter package.json/lock/vite.config/tsconfig para o estado v55 (rolldown-vite).

Bump: APP_VERSION/CACHE_NAME = v56.
