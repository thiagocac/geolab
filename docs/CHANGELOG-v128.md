# CHANGELOG v128 — Gestão de usuários robusta + matriz de permissões detalhada (RBAC religado)

## Banco — migrations 109 e 110 (já aplicadas via MCP)
- **109:** catálogo de permissões expandido para **59** (17 categorias) com risco/descrição; seed da matriz nos 7 papéis
  built-in (admin/admin_consulte = tudo; gestor_qualidade = 48; laboratorista = 25; operador_campo = 17; financeiro = 14; cliente = 4).
- **110:** RPCs `current_member_permissions()` (permissões efetivas do usuário logado), `list_lab_members()`
  (papéis + escopo + último login), `set_member_obras`, `set_member_override`, `update_member`,
  `upsert_role`, `clone_role`, `set_role_active` — SECURITY DEFINER, search_path fixo, guard `is_tenant_admin OR current_has_permission`.

## Frontend
- **auth:** novo `can(permissão)` carregado de `current_member_permissions` (guarda-chuva admin/admin_consulte). A UI passa a autorizar por permissão.
- **Operação › Usuários (reforma):** busca + filtro por papel/status; chips de papéis, escopo (todas/N obras), exceções e **último acesso**;
  **ficha de edição** com dados, **múltiplos papéis** (member_roles), **escopo de obras** (member_obras) e **exceções de permissão** (allow/deny por usuário).
- **Acessos › Papéis e permissões (reforma):** aba **Matriz** agrupada por categoria com **risco** (cor) + descrição + busca;
  aba **Papéis** para **criar/clonar/editar/desativar** papéis custom por laboratório.
- **Laudos:** emitir/aprovar religado a `can('laudo.aprovar')` (a matriz e as exceções passam a valer; admin sempre pode).

## Verificado vivo
- 59 permissões; admin resolve 59 efetivas; matriz semeada coerente; advisor sem problema novo (só o WARN genérico de RPC SECURITY DEFINER, padrão do projeto).

## Próximo (Fase 2, não nesta release)
- Migrar incrementalmente os demais gates de navegação (hasRole→can); reset/reenvio de senha (EF); consolidar members.role→member_roles; member_materiais (v1.1).

CACHE_NAME=consultegeo-geolab-v128 · APP_VERSION=v128
