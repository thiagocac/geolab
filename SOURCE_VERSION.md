# GEOLAB → Concresoft — SOURCE VERSION v52
CACHE_NAME: consultegeo-geolab-v52 · APP_VERSION: v52

## v52 — Versao na UI automatica + ds.md reescrito (Fase 0)
- src/components/Layout.tsx: rodape deixa de ter "Concresoft v36" hardcoded e passa a ler APP_VERSION
  de src/lib/telemetry/core.ts (import novo). A versao exibida agora sincroniza com o bump.
- ds.md (project-knowledge na raiz do projeto — NAO vai no repo): reescrito para o estado real
  (Mona Sans, OKLCH liberado no GEOLAB como flagship, padrao de cadastro A drawer/C pagina, Base UI alvo,
  status do roadmap v50-v52).
- Sem mudanca de comportamento, sem backend. Bump => v52. npm run build verde (gate completo).
