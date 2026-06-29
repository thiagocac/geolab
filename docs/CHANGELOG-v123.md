# CHANGELOG v123 — Ondas 1+2+3+4 (GeoCon→GEOLAB), frontend cumulativo

Renumerado de v122 (colidia com a Onda 3). Frontend vivo = v116.

## Backend (aplicado via MCP em xbdvyvvxvzmcosnekmfv — NÃO entra nos zips)
- Onda 1: 093 audit_log + trigger; 094 timeline.
- Onda 2: 095–098 matriz/gate; EF generate-laudo-ensaio-pdf v17 (gate LIVE).
- Onda 3: 099–102 RBAC/delegações/segurança da conta; EF auth-password-hook v1.
- Onda 4: 103 broadcast (ack), 104 admin_backlog, 105 webhooks/API (api_keys + tenant_webhooks + fila retry/backoff + trigger no notify_event_outbox = no-op sem webhooks), 106 hardening (revoga 7 RPCs de webhook de anon/public). EF dispatch-outgoing-webhooks v1 (cron-secret; inerte sem cron).

## Frontend (entra nos zips v123)
- /gestao/timeline, /gestao/documentos, /gestao/rbac, /gestao/delegacoes, /gestao/seguranca-conta, /gestao/comunicados, /gestao/backlog, /gestao/webhooks.
- src/App.tsx + Layout.tsx: rotas e menu das 8 telas.
- Bump conjunto sw.js + core.ts → v123.
