# GEOLAB → Concresoft — SOURCE VERSION v50
CACHE_NAME: consultegeo-geolab-v50 · APP_VERSION: v50

## v50 — Code-splitting por rota + xlsx sob demanda (Fase 0 da modernização de frontend)
- src/App.tsx: as ~27 páginas de rota agora carregam via React.lazy() + <Suspense fallback={<LoadingState/>}>
  (antes: imports estáticos => bundle único). As rotas pública /validar e principal têm cada uma seu Suspense.
  O shell (LoginScreen, TenantSelectionPage, Layout) segue eager.
- xlsx: import estático trocado por `await import('xlsx')` nos 4 pontos de uso (ProdutividadePage.exportar,
  MedicaoPage.exportar, RompimentosPage.exportarModelo e o reader.onload de importacao). xlsx (~143 kB gzip)
  vira chunk proprio, carregado so na acao de exportar/importar — fora do load inicial.
- pdfjs-dist: nao e usado no frontend (dep orfa) — sem mudanca.
- Sem mudanca visual, sem backend, sem deps novas. Bump CACHE_NAME+APP_VERSION => v50.
- Gate verde no sandbox: check-source + tsc --noEmit + vitest + vite build (chunks separados por rota).
