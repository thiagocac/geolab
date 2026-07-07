# Release v181 — patches sobre a v180

**O que é:** Release A da auditoria de UX/responsividade (doc `GEOLAB-Auditoria-UX-Responsividade-v1.md`) + os 2 P0 — frontend puro (sem migration, sem EF, espelhos de EF intocados).

**Como aplicar:** copiar todos os arquivos deste zip por cima do repositório (mesma estrutura de pastas), commitar e dar push — o Netlify CI builda (`check-source → tsc → vitest → vite build`).

**Bump:** `CACHE_NAME consultegeo-geolab-v181` (public/sw.js) + `APP_VERSION v181` (src/lib/telemetry/core.ts) já bumpados juntos neste zip.

**Resumo:** grades de Importações com scroll (P0 mobile); `--navy` legível no dark (P0 Coleta de fôrmas); confirmações em Falha/Ausente (+ ação Reativar), Contraprova, Arquivar backlog, Girar segredo/Revogar API key; prompt de revogação de delegação vira modal; filtro de status dos Laudos no servidor; acentuação PT-BR em ~40 arquivos; kickers "Onda N" removidos da UI; grafia "fôrmas"; grids fixos → responsivos; rótulos De/Até na Central; filtro vence30 em Colaboradores + deep-link de Pendências; "editar numeração"; Ctrl+K fora do Mac; rótulos de status da Coleta.

**Arquivos (53):** ver lista em `SOURCE_VERSION.md` / diff da release.
