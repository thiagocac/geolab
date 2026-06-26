# INSTRUÇÕES — Release CONSOLIDADO v86 (portal completo + ficha + comentários/contestação) — UM push

Supersede v80–v85. Contém TODO o trabalho da sessão. **Um push** com os arquivos abaixo.

## Já aplicado por mim via MCP (NADA a fazer no Supabase)
Migrations: **063 · 064 · 065 · 066** (066 = comentários/contestação de laudo).
Edge Functions: lab-client-portal **v10** · portal-anexo v1 · generate-ficha-moldagem-pdf v12 · extract-ficha-vision v4 · notify-cliente-evento **v2**.

## Frontend para commitar (GitHub → Netlify CI)
Novos: src/lib/portal/{types,resultados}.ts, src/lib/api/{portalResultados,comentarios}.ts, src/components/portal/{ParcialFinalBadge,LaudosResultadosPanel,EvolucaoExemplares,TendenciaResistencia,ComentariosLaudo}.tsx, src/pages/portal/PortalPublicoPage.tsx + (referência) migrations 063–066 e EFs lab-client-portal/portal-anexo/notify-cliente-evento.
Alterados: src/App.tsx, src/lib/api/{portalCliente,clientUsers,laudo,concretagem,rompimento}.ts, src/pages/portal/{ClientePortalPage,ClienteUsuariosPage}.tsx, src/pages/concreto/{LaudosPage,ConcretagensPage}.tsx, src/lib/telemetry/core.ts (v86), public/sw.js (v86) + (referência) EFs generate-ficha-moldagem-pdf/extract-ficha-vision.

## Novidade v86 — Comentários e contestação de laudo (C1/C2)
Thread laboratório↔cliente por laudo (tabela `portal_comentarios`, leitura por RLS, escrita por RPC `postar_comentario_portal`). O cliente comenta ou **contesta um resultado** (flag `contestacao`); o RT/gestor vê e **resolve** (`resolver_comentario_portal`). No portal: dentro de "Ver resultados" de cada laudo. Na **LaudosPage** (staff): botão "Comentários" por laudo, com resolver. (O portal público por magic link NÃO comenta — sem sessão de auth.)

## Gate
check-source OK; revisões independentes (todas as etapas, incl. v86): SHIP, 0 must-fix. tsc/biome/vitest no Netlify CI.
Lembrete operacional do v85: alerta < fck envia e-mail real ao cliente (prod dispatch on) — confirme o 1º envio.
