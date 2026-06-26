# INSTRUÇÕES — Release CONSOLIDADO v85 (portal + ficha + e-mail/anexo cliente) — UM push

Supersede v80–v84. Contém TODO o trabalho da sessão. **Um push** com os arquivos abaixo.

## Já aplicado por mim via MCP (NADA a fazer no Supabase)
Migrations: **063** · **064** · **065**.
Edge Functions: **lab-client-portal v10** (anexo no portal público) · **portal-anexo v1** · **generate-ficha-moldagem-pdf v12** (Modelo A) · **extract-ficha-vision v4** · **notify-cliente-evento v2** (NOVA — e-mail ao cliente via send-notification).

## Frontend para commitar (GitHub → Netlify CI)
Novos: src/lib/portal/{types,resultados}.ts, src/lib/api/portalResultados.ts, src/components/portal/{ParcialFinalBadge,LaudosResultadosPanel,EvolucaoExemplares,TendenciaResistencia}.tsx, src/pages/portal/PortalPublicoPage.tsx + (referência) migrations 063/064/065 e EFs lab-client-portal/portal-anexo/notify-cliente-evento.
Alterados: src/App.tsx, src/lib/api/{portalCliente,clientUsers,laudo,concretagem,rompimento}.ts, src/pages/portal/{ClientePortalPage,ClienteUsuariosPage}.tsx, src/pages/concreto/{LaudosPage,ConcretagensPage}.tsx, src/lib/telemetry/core.ts (v85), public/sw.js (v85) + (referência) EFs generate-ficha-moldagem-pdf/extract-ficha-vision/lab-client-portal.

## Novidades v85
- **E-mail ao cliente quando um resultado fica < fck** na idade de controle: o hook `maybeNotifyAbaixoFck` chama a nova EF `notify-cliente-evento`, que resolve o e-mail do cliente NO SERVIDOR e roteia pela `send-notification` (único ponto de saída Resend; aplica allowlist/supressão/dispatch/dry-run + dedupe por evento). **Laudo emitido** já envia o PDF ao cliente pela `enviar-laudo-cliente` (desde antes).
- **Download de anexo no portal público** (magic link): `lab-client-portal v10` devolve `metadata.anexos` e assina o anexo (escopo: a concretagem tem de ser de uma obra do cliente).

## ATENÇÃO (e-mail real)
A produção está com `dispatch_enabled=true, dry_run=false, allowlist=[]` (passa-tudo). Logo, o alerta de **< fck** passa a **enviar e-mail real** ao contato do cliente (`lab_clients.email`), uma vez por exemplar (dedupe). Se quiser segurar, ajuste a allowlist/dry_run em `notification_dispatch_settings`. **Confirme o 1º envio.**

## Gate
check-source OK; revisões independentes (portal, EF pdf-lib, v84, v85): SHIP, 0 must-fix. tsc/biome/vitest no Netlify CI.
