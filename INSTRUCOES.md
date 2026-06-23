# GEOLAB — Patch v29 (programação + concretagem 2-etapas + campos dinâmicos + PORTAL DO CLIENTE seguro)

Integração avaliada do v29 do GPT no nosso tronco. O v29 do GPT era superset do meu v28 (forkou dele),
então foi adotado como base; reconciliei segurança e o download de laudo.

## Backend já aplicado no banco vivo (via MCP)
- **029_programacao_campos_dinamicos** — config_lab.concretagem_campos, member_obras.deleted_at + índice único parcial,
  defaults de concretagem/recebimento/laudo_campos, helper member_can_access_work.
- **030_cliente_isolation_rls** — **isolamento do papel `cliente`**: `is_tenant_member` passa a EXCLUIR cliente
  (bloqueia o cliente nas ~40 políticas sel_), self-read em members/member_obras/tenants, leituras escopadas por obra
  (client_works/concretagens/lab_reports/lab_clients via member_can_access_work). **Testado**: cliente só enxerga a obra
  vinculada; bloqueado de resultados, CPs, colaboradores e dados de outras obras/clientes.

> A migration 029 que o GPT entregou NÃO isolava o cliente (RLS é OR-permissivo; políticas adicionais só ampliam).
> Foi descartada e refeita como 029+030 acima.

## Edge Functions (deploy via MCP)
- **portal-laudo-url** (NOVA, minha) — assina download de laudo só após verificar escopo (cliente não tem policy de
  storage para `laudos/`, e policy de storage não escopa por obra → vazaria; por isso EF service-role).
- **admin-create-client-user**, **client-portal-submit-programacoes** — auditadas e deployadas (gates + escopo server-side).
- **generate-laudo-ensaio-pdf** — campos dinâmicos (recebimento_campos/concretagem_campos) + texto v4 (NBR 12655/fck,est).
- **generate-ficha-moldagem-pdf** — respeita campos dinâmicos.

## Frontend (v29)
Concretagem em 2 etapas (ConcretagemDetalhePage), ProgramacoesPage (fila do lab), CamposConcretagemPage/CamposRecebimentoPage
(toggles dinâmicos), MoldingStandardEditor, **Portal do cliente** (ClientePortalPage: grid de programação→EF, consulta de
concretagens/laudos, download via EF segura) e **ClienteUsuariosPage** (criar usuário cliente + vincular obras).
Rotas: /programacoes, /gestao/campos-recebimento, /gestao/campos-concretagem, /portal-cliente, /portal/usuarios-clientes.
Build completo (check-source+tsc+vitest+vite) verde. CACHE_NAME/APP_VERSION = v29.

## Segurança do portal (resumo)
O cliente é um usuário Auth real com `role='cliente'`, **read-only no nível de tabela**, escopado por `member_obras`.
Programação e download de laudo passam por EF service-role com verificação server-side. Sem magic link (v1.1).
