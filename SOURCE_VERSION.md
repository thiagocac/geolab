# GEOLAB → Concresoft — SOURCE VERSION v53
CACHE_NAME: consultegeo-geolab-v53 · APP_VERSION: v53

## v53 — React 18.3 -> 19.2 (Fase 1; conservador, sem Compiler)
- Deps: react/react-dom ^19 (instalado 19.2.7), @types/react ^19 (19.2.17), @types/react-dom ^19,
  react-router-dom ^6.28 (instalado 6.30.4; mantem API v6 — RR7 fica para a Fase 4).
- ZERO mudanca de codigo: o app ja estava limpo dos padroes que o React 19 quebra (sem useRef() vazio,
  sem JSX.Element, sem React.FC/defaultProps/forwardRef; ja usa createRoot+StrictMode). tsc = 0 erros.
- vite.config.ts: manualChunks passou de forma-objeto p/ forma-funcao. Motivo: a forma-objeto
  ['react','react-dom'] deixou de capturar o react-dom 19 (mudou layout de modulos), jogando o React no
  chunk index. A funcao re-separa react/react-dom/scheduler no 'vendor' (cache proprio): index ~54kB,
  vendor ~193kB (60kB gzip).
- Compiler NAO entrou (isolado para o v54). Bump => v53. npm run build verde (gate completo).
