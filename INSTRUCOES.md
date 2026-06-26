# INSTRUÇÕES — Release CONSOLIDADO v87 (portal + ficha + comentários + NF/OCR por caminhão) — UM push

Supersede v80–v86. Contém TODO o trabalho da sessão. **Um push** com os arquivos abaixo.

## Já aplicado por mim via MCP (NADA a fazer no Supabase)
Migrations: **063 · 064 · 065 · 066**. EFs: lab-client-portal v10 · portal-anexo v1 · generate-ficha-moldagem-pdf v12 · extract-ficha-vision v4 · notify-cliente-evento v2 · (extract-nf-vision já existia, sem mudança).
(v87 é **só frontend** — não precisou de banco/EF: a EF de OCR de NF e o `receipt_id` em `evidencias` já existiam.)

## Frontend para commitar (GitHub → Netlify CI)
Novos: src/lib/portal/{types,resultados}.ts, src/lib/api/{portalResultados,comentarios}.ts, src/components/portal/{ParcialFinalBadge,LaudosResultadosPanel,EvolucaoExemplares,TendenciaResistencia,ComentariosLaudo}.tsx, src/pages/portal/PortalPublicoPage.tsx + (referência) migrations 063–066 e EFs lab-client-portal/portal-anexo/notify-cliente-evento.
Alterados: src/App.tsx, src/lib/api/{portalCliente,clientUsers,laudo,concretagem,rompimento}.ts, src/pages/portal/{ClientePortalPage,ClienteUsuariosPage}.tsx, src/pages/concreto/{LaudosPage,ConcretagensPage,ConcretagemDetalhePage}.tsx, src/lib/telemetry/core.ts (v87), public/sw.js (v87) + (referência) EFs generate-ficha-moldagem-pdf/extract-ficha-vision.

## Novidade v87 — NF/DANFE por caminhão + OCR (C4)
No "Adicionar caminhão", o botão **"Ler NF (foto)"** já fazia OCR (EF extract-nf-vision) para autopreencher os campos; agora a **foto da NF é guardada** e, ao salvar o caminhão, é anexada como **evidência do caminhão** (`evidencias.receipt_id`, tipo `nf`). Cada caminhão na lista ganha um link **"Ver NF"**. `addCaminhao` passou a retornar o `receipt_id`.

## Gate
check-source OK; revisões independentes (todas as etapas, incl. v87): SHIP, 0 must-fix. tsc/biome/vitest no Netlify CI.
Lembrete v85: alerta < fck envia e-mail real ao cliente (prod dispatch on) — confirme o 1º envio.
