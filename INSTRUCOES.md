# Patches v54 — React Compiler 1.0 (memoizacao automatica)

Aplicar por cima da v53, commitar, deixar o Netlify buildar.
IMPORTANTE: package.json + package-lock.json mudaram (devDep babel-plugin-react-compiler). `npm ci` instala.

## Arquivos (7)
- package.json              (+devDep babel-plugin-react-compiler ^1.0.0)
- package-lock.json
- vite.config.ts            (compiler via @vitejs/plugin-react babel.plugins, target '19')
- src/lib/telemetry/core.ts (APP_VERSION = 'v54')
- public/sw.js              (CACHE_NAME = 'consultegeo-geolab-v54')
- SOURCE_VERSION.md / INSTRUCOES.md

## O que muda
- React Compiler 1.0 ligado no build (memoizacao automatica — menos re-render, sem useMemo/useCallback manual).
  Build-time apenas; NENHUMA mudanca de codigo de componente. Em React 19 usa o runtime embutido.
- Healthcheck: 69/69 componentes otimizados, 0 violacao das Regras do React, StrictMode ok.
- Build fica mais lento (~13s vs ~8s) porque o Babel passa em cada arquivo — esperado.

## Validacao (sandbox)
- npx react-compiler-healthcheck => 69/69 compilados, sem violacao, sem lib incompativel.
- npm run build => check-source OK · biome lint 0 erros · tsc 0 erros · vitest 1/1 · vite build OK · EXIT 0.
- Prova: cache do compiler ($[n]) nos chunks + react/compiler-runtime no vendor.

## Verificar no Deploy Preview
- Clicar nos fluxos pesados (Rompimentos, ConcretagemDetalhe, Medicao): comportamento identico
  (o compiler so memoiza o que prova seguro). React DevTools mostra o selo "Memo".

## Rollback
- Remover o babel.plugins do vite.config.ts (volta ao React 19 sem compiler).

Bump: APP_VERSION/CACHE_NAME = v54.
