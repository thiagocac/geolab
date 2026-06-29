# CHANGELOG v122 — Ondas 1+2+3 (GeoCon→GEOLAB), frontend cumulativo

Renumerado de v121 (colidia com a Onda 2). Frontend vivo = v116.

## Backend (aplicado via MCP em xbdvyvvxvzmcosnekmfv — NÃO entra nos zips)
- Onda 1: 093 audit_log + trigger 14 tabelas; 094 timeline RPCs.
- Onda 2: 095–097 matriz documental/conformidade/gate; 098 operador=aviso; EF generate-laudo-ensaio-pdf v17 (gate LIVE, bloqueia calibração de equipamento vencida).
- Onda 3: 099 RBAC granular (permissions/roles/role_permissions/member_roles/overrides + helpers; segrega resultado.lancar ≠ laudo.aprovar); 100 delegações de aprovação; 101 segurança da conta (login_events/auth_attempt_log + RPCs + password hook DB); 102 hardening (member_has_permission fora de authenticated). EF auth-password-hook v1 (opcional).

## Frontend (entra nos zips v122)
- Onda 1: /gestao/timeline.
- Onda 2: /gestao/documentos.
- Onda 3: /gestao/rbac (matriz papel×permissão), /gestao/delegacoes, /gestao/seguranca-conta; auth.tsx registra login (best-effort).
- src/App.tsx + Layout.tsx: rotas e menu das 5 telas.
- Bump conjunto sw.js + core.ts → v122.
