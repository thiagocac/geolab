# CHANGELOG v118 — pós-auditoria GPT Pro (validada e adaptada por Claude)

Base: v117 (Central cockpit). A auditoria do GPT foi feita sobre v115/v116; o frontend v117 já
incorporava quase todo o patch v116, então só o delta real e seguro entrou aqui.

## Backend (aplicado via MCP no projeto xbdvyvvxvzmcosnekmfv — NÃO entra nos zips)
- **089_harden_security_definer_execute_grants** — REVOKE EXECUTE de `public/anon/authenticated`
  em 22 funções SECURITY DEFINER. Helpers de trigger (NC) e funções de EF (magic-link, fn_*_por_obras)
  ficam service-role-only; RPCs de portal/painel mantêm `authenticated` (sem `anon`). Assinaturas
  conferidas 1 a 1 ao vivo; frontend não chama as service-only (só `database.types.ts`). [SEC-001 P1]
- **090_observabilidade_service_only_deny_policies** — deny-policy explícita p/ `anon/authenticated`
  em `client_telemetry_rate_limit` e `frontend_canary_checks` (service_role bypassa). Advisor
  `rls_enabled_no_policy` zerado. [SEC-002 P2]
- **091_perf_indices_hot_paths_enxuto** — 8 índices compostos novos (concretagens/material_tests/
  lab_reports por tenant+data; notification_dispatch_log por status/evento; correlação em
  `notify_event_outbox.trace_id` e `ef_invocation_log.request_id`; client_telemetry por release).
  Descartadas ~30 duplicatas/redundâncias da proposta (FKs já indexadas e índices já existentes). [PERF-002 P2]

## Frontend (entra nos zips v118)
- **VirtualTable**: cabeçalho ordenável passa de `<div onClick>` para `<button type=button>`
  (foco/teclado) + reset CSS no `.vt-th`. [A11Y-001]
- **EmailLogPage**: remoção de import morto (`listDispatchLog`).
- Bump de cache/versão: `public/sw.js` e `src/lib/telemetry/core.ts` → **v118**.
- `SOURCE_VERSION.md` reconciliado de v111 (stale) para v118. [REL-002]

## Pendências (não automatizáveis aqui)
- **SEC-003**: ligar *Leaked password protection* em Supabase → Authentication → Policies (painel).
- **MT-001 (revisão)**: o `sw.js` mantém handler `fetch` (network-first c/ fallback a cache). O
  relatório do GPT dizia que o patch removia — **não removia** (sw.js do patch == v117). Remoção
  fica para release dedicada, se desejado.
- **OBS-001**: padronizar `x-trace-id` como fonte primária nas EFs (hoje há fallback por query) — backlog.

## Não aplicado de propósito (v117 igual ou superior à proposta do GPT)
ConcretagensPage (Central cockpit > versão do GPT), CommandPalette/ConcretagemDetalhePage (deps de
efeito melhores), portal/resultados.ts (`<\/script>` corretamente escapado), xlsx.ts (biome-ignore necessário).
