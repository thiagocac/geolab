# GEOLAB → Concresoft — SOURCE VERSION v56
CACHE_NAME: consultegeo-geolab-v56 · APP_VERSION: v56

## v56 — Vite 8 nativo (Rolldown+Oxc) + plugin-react v6 + vitest 3 (Fase 1)
- vite 8.1.0 (sai do alias rolldown-vite; Rolldown nativo). @vitejs/plugin-react 6.0.3 (Oxc no JSX/refresh,
  sem Babel interno). vitest 3.2.6 UNIFICADO no vite 8 (acabou o vite 5 aninhado da v55).
- React Compiler religado pelo caminho novo: @rolldown/plugin-babel 0.2.3 + reactCompilerPreset() do
  plugin-react, no array `presets`; ORDEM babel() ANTES de react(). +@babel/core +@types/babel__core.
  Prova: 765 memo-slots $[n] no index + react/compiler-runtime.
- tsconfig: moduleResolution 'Node' -> 'bundler' (OBRIGATORIO: os tipos do Vite 8 vem por exports maps).
- vite.config: manualChunks(id: string) tipado. Build ~5.6s (mais rapido que v54/v55: Oxc faz o JSX,
  Babel so o compiler). Chunks: vendor ~182kB, xlsx isolado.
- Bump => v56. npm run build verde. Sem mudanca de codigo de componente.
