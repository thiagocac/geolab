# CHANGELOG v129 — RBAC Fase 2 (seed de novos labs, reset de senha, permissões efetivas, gates religados)

## Banco — migration 111 (já aplicada via MCP)
- `seed_builtin_roles_and_permissions(tenant)`: cria os 7 papéis built-in + semeia a matriz completa (reutilizável).
  Aplicada aos tenants existentes (delta: RT ganhou `medicao.gerar`; laboratorista ganhou `nc.ver`/`nc.gerenciar`).
- Backfill de `member_roles` a partir de `members.role`/`roles[]`.
- `member_effective_permissions(member_id)`: permissões efetivas de um usuário (guard admin/usuario.ver).

## Edge Functions (deployadas; ezbr_sha256 mudou)
- **admin-create-lab v8**: passa a chamar `seed_builtin_roles_and_permissions` — novos laboratórios já nascem com papéis e matriz completos (antes não criava papéis nem matriz).
- **admin-reset-password v1 (nova)**: redefine a senha de um usuário (gera provisória); guard admin do lab/admin_consulte.

## Frontend
- **Operação › Usuários (ficha):** botão **Redefinir senha** + seção **Permissões efetivas** (read-only, agrupada por categoria).
- **Gates religados a `can()`:** Medição (`medicao.gerar`), Faturas (`fatura.gerar`), Config. de Campos (`config.campos`),
  Lotes (`lote.aceitar`), NC (`nc.gerenciar`), tolerância de NC (`nc.gerenciar`). Comportamento legado preservado (seed ajustado); admin sempre via guarda-chuva.

CACHE_NAME=consultegeo-geolab-v129 · APP_VERSION=v129
