# v157 — Fecho do backlog da auditoria + acabamento do traço (02/07/2026)

1. **Migration 138**: UNIQUE de código de traço por escopo — `(tenant_id, client_id, work_id, lower(codigo))
   NULLS NOT DISTINCT where deleted_at is null and codigo <> ''`. Dois traços de catálogo com o mesmo código
   também colidem. Zero duplicatas pré-existentes (verificado antes de aplicar).
2. **Migration 139**: `concretagens_central_paged` — status técnico distingue **cancelada** (1º branch do CASE).
   Alinha a Central com a `pendencias_resumo` (mig 134): cancelada não aparece mais como "programado" nem entra
   no deep-link de Pendências. Central ganha a opção "Cancelada" no filtro (StatusBadge já cobria).
3. **Agenda EF v11** (`3c7454e4…`, MCP): `labName` prioriza o vínculo `is_selected` — multi-lab via ordenação
   `is_selected desc nullsLast` no `members`. Espelho do repo atualizado junto.
4. **Seletor de traço exibe "· controle Xd"** (`listTracosComFck` + `TracoOptions`): o operador vê qual idade
   de aceitação vale para cada traço antes de escolher.

Registros fiéis em `docs/138_*.sql` e `docs/139_*.sql`. Migrations 138–139 e a EF v11 JÁ APLICADAS no vivo via MCP.
