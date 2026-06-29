# CHANGELOG v119 — backlog da auditoria GPT Pro (por Claude)

Continuação da v118. Itens: hardening das SECURITY DEFINER restantes (SEC-001) + OBS-001/LGPD-001.

## Backend (aplicado via MCP — NÃO entra nos zips)
- **092_harden_internal_function_execute_grants** — REVOKE EXECUTE de `public/anon/authenticated` em 11
  funções SECURITY DEFINER **internas** (não são API do frontend): `notify_event_dispatch`,
  `notify_scan_calibracao/_cp_atrasado/_resultado_abaixo_fck`, `gerar_ncs_cp_atrasado`,
  `telemetry_ops_alarm_run`, `telemetry_notify_pending_alerts`, `is_in_quiet_hours`,
  `seed_nc_action_engine`, `seed_nc_rac_padrao`, `list_public_tables`.
  Validação ao vivo: 0 referências no frontend e **0 callers SECURITY INVOKER** (só rodam por
  cron/service_role/contexto definer). Helpers de RLS (`current_*`, `is_tenant_*`, `has_role`,
  `member_can_access_work`, `app_trace_id`, `select_tenant`) e RPCs de aplicação seguem `authenticated`. [SEC-001]

## Frontend (entra nos zips v119)
- **OBS-001 / LGPD-001** — `src/lib/telemetry/instrument.ts`: o flush no `pagehide` (fetch keepalive)
  deixa de colocar `apikey` na **query string** (some dos logs); o `apikey` segue no **header**. O fallback
  `sendBeacon` mantém `?apikey=` (a API não permite header) — aceitável (anon key pública, redigida nos logs).
- Bump `public/sw.js` + `src/lib/telemetry/core.ts` → **v119**; `SOURCE_VERSION.md` atualizado.

## Decisão técnica — trace NÃO migrado para header (diverge do GPT, fundamentado)
A auditoria sugeriu `x-trace-id` como header primário nas EFs. O código **já documenta** (em
`src/lib/supabase.ts`) que EF usa `?trace_id=` **de propósito**: header custom dispararia **preflight CORS**
contra a allow-list fixa das EFs. Migrar exigiria alterar CORS + `readTraceId` e **redeploy das ~35 EFs**
(alto risco) para ganho marginal de higiene de log. Mantido: **query em EF, header `x-trace-id` em REST**
(este último já implementado e consumido por `app_trace_id()`).
