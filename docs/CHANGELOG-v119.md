# v119 — Onda 1 GeoCon→GEOLAB: auditoria + linha do tempo

## Frontend

- Bump coordenado de `CACHE_NAME` e `APP_VERSION` para `v119`.
- Nova API `src/lib/api/timeline.ts` para consumir as RPCs de timeline.
- Nova tela `/gestao/timeline` com recortes por laboratório, obra e concretagem.
- Menu lateral e command palette passam a expor **Linha do tempo** para `admin`/`admin_consulte`.

## Backend separado

- `093_audit_log_foundation.sql`: tabela `audit_log`, função `audit_row_change()`, imutabilidade append-only e triggers nas tabelas sensíveis.
- `094_timeline_rpcs.sql`: RPCs `list_tenant_timeline`, `list_work_timeline` e `list_concretagem_timeline`, combinando auditoria + marcos técnicos.

## Validação

- Frontend preparado para `check-source`, Biome, TypeScript, Vitest e Vite.
- Aplicação do backend deve ocorrer via Claude/MCP, uma migration por vez, antes de expor a tela em produção.
