# Patch v195 — EF-only: telemetry-alarm v44 (error_rate só na versão viva)

**Tipo:** só Edge Function. **SEM** bump de APP_VERSION/CACHE_NAME (não toca frontend).
**Deploy:** JÁ aplicado no vivo via MCP — `telemetry-alarm` **v44**, ezbr_sha256 `b4fd21cbc175…` (era `f07895e2…`). Status ACTIVE, verify_jwt=false.

## O que muda
No cálculo do alarme de `error_rate` (loop sobre `v_client_health_by_version`): passa a alarmar
**apenas a versão viva** — a mais nova (maior `vNNN`) com volume relevante (≥ `alert_min_events`) — e
as mais novas que ela (canário de um novo deploy). Versões **anteriores** em cache deixam de alarmar:
os erros delas (chunk-load pós-deploy, `invalid date` do dashboard etc.) já foram corrigidos no
release vivo e não são acionáveis num cliente que não atualiza. Não usa "a mais popular" porque a
janela da view é de 7 dias (a versão anterior ainda pode ter mais eventos acumulados que a viva).
Zero mudança nas demais checagens (web-vitals, crons, dead-letter, EF 5xx/p95).

## AÇÃO OBRIGATÓRIA (senão o push reverte)
O push GitHub→Supabase redeploya as EFs a partir do espelho `/app`. **Commite este arquivo** antes/
junto do próximo push, senão ele restaura a versão antiga por cima do v44:

    supabase/functions/telemetry-alarm/index.ts

## Numeração
v194 foi tomado por outra sessão (RBAC matriz v2). Este patch é **v195**, EF-only. Se v195 também
estiver tomado, renumere — é o mesmo arquivo único.
