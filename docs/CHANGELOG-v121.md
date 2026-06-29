# v121 — Onda 3 GeoCon → GEOLAB: RBAC granular, delegações e segurança da conta

## Entrega

- Nova tela `/gestao/rbac` para matriz papel × permissão.
- Nova tela `/gestao/delegacoes` para delegações temporárias de aprovação técnica.
- Nova tela `/gestao/seguranca-conta` para eventos de login e resumo de tentativas de autenticação.
- Registro best-effort de login após autenticação, sem bloquear a sessão.
- Bump conjunto: `CACHE_NAME=consultegeo-geolab-v121` e `APP_VERSION=v121`.

## Backend separado

- `098_rbac_granular_permissions.sql` — catálogo de permissões, papéis, permissões por papel, papéis por membro e RPCs `current_has_permission`, `has_permission`, `list_rbac_matrix`, `set_role_permissions`.
- `099_approval_delegations.sql` — tabela `approval_delegations`, helper de resolução e extensão não destrutiva de `approval_steps` com colunas de delegação.
- `100_account_security.sql` — `login_events`, `auth_attempt_log`, RPCs de trilha/summary, função `password_verification_hook` e alarme SQL `telemetry_auth_alarm_run`.
- EF opcional `auth-password-hook`, com `AUTH_HOOK_SECRET`, para registrar tentativas vindas do Supabase Auth Hook.

## Base

Base frontend: v120/Onda 2. Migrations numeradas para aplicação após as migrations 095–097 reservadas pela Onda 2.
