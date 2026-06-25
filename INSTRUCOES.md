# INSTRUÇÕES — Patch v81 (12 melhorias do portal do cliente, em ordem de prioridade)

## Já aplicado por mim via MCP (NÃO precisa fazer nada no Supabase)
- **Migration 064** `064_portal_melhorias_classificacao_magiclink` — aplicada em `xbdvyvvxvzmcosnekmfv`.
- **EF `lab-client-portal` v9** — sha `dfe2b8b1…` (marca último acesso do magic link).
- **EF `portal-anexo` v1** — sha `2d65bdeb…`, verify_jwt=true (upload/download de anexos da programação no bucket privado `anexos`).

## O que VOCÊ faz (frontend → GitHub → Netlify CI): commitar e dar push
### Novos
- `src/components/portal/EvolucaoExemplares.tsx`
- `supabase/migrations/064_portal_melhorias_classificacao_magiclink.sql` (ref.; já aplicada)
- `supabase/functions/portal-anexo/index.ts` (ref.; já deployada)

### Alterados
- `src/lib/portal/types.ts`, `src/lib/portal/resultados.ts`
- `src/components/portal/LaudosResultadosPanel.tsx`
- `src/lib/api/portalCliente.ts`, `src/lib/api/clientUsers.ts`, `src/lib/api/laudo.ts`
- `src/pages/portal/ClientePortalPage.tsx`, `src/pages/portal/PortalPublicoPage.tsx`, `src/pages/portal/ClienteUsuariosPage.tsx`
- `src/pages/concreto/LaudosPage.tsx`
- `supabase/functions/lab-client-portal/index.ts` (ref.; já deployada v9)
- `src/lib/telemetry/core.ts` + `public/sw.js` (v81)

## As 12 melhorias (na ordem do documento)
1. **Curva de evolução** por exemplar (idade×resistência + linha do fck) no "Ver resultados".
2. **CPs atrasados**: card de alerta + badge "atrasado" + contagem (pendente, rompimento vencido sem resultado).
3. **E-mail ao cliente quando laudo vira Final**: selo Parcial/Final na LaudosPage (staff); ao **Emitir** um laudo Final, o sistema chama `enviar-laudo-cliente` automaticamente (best-effort, respeita gating de e-mail).
4. **Painel-resumo** (cards): laudos finais/parciais, exemplares conformes/não conformes, CPs atrasados.
5. **Filtro por período** (De/Até) — laudos por emissão, resultados por rompimento.
6. **Exportar PDF** do conjunto filtrado (via impressão do navegador; sem nova dependência).
7. **Status amigável** da programação (StatusBadge) nos dois portais.
8. **Anexar arquivo (NF/DANFE)** à programação: botão por concretagem em "Minhas concretagens" (EF `portal-anexo`, ≤8MB, bucket `anexos`).
9. **Magic link**: card "Links de portal ativos" com último acesso/contador + **Revogar** (Usuários de clientes).
10. **Acessibilidade**: `role=tablist/tab` + `aria-selected` nas abas dos dois portais.
11. **Paginação** (50/página) na tabela de resultados.
12. **Detalhes técnicos** (toggle): carga kN, Ø×h, tipo de ruptura.

## Gate
`check-source` OK no sandbox; revisão de código independente: **SHIP** (0 erros). `tsc/biome/vitest` rodam no Netlify CI.
