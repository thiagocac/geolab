# INSTRUÇÕES — Release CONSOLIDADO v88 (portal completo + ficha + extras) — UM push

Supersede v80–v87. Contém TODO o trabalho da sessão. **Um push** com os arquivos abaixo.

## Já aplicado por mim via MCP (NADA a fazer no Supabase)
Migrations: **063 · 064 · 065 · 066 · 067** (067 = teto server-side de 5000 em fn_resultados_por_obras).
EFs: lab-client-portal v10 · portal-anexo v1 · generate-ficha-moldagem-pdf v12 · extract-ficha-vision v4 · notify-cliente-evento v2.

## Novidades v88
- **F1 — guardrail de carga:** `fn_resultados_por_obras` agora retorna no máx. 5000 CPs mais recentes; o portal mostra um aviso "filtre por obra/período" quando atinge o teto. Não quebra filtros nem exportação. (i18n/F2 ficou de fora — produto BR, baixo uso; volta sob demanda.)
- **B2 — linha do tempo da concretagem:** dentro de "Ver resultados" de cada laudo, um stepper **Programada → Concretada → Moldada → Rompida → Laudo** com as etapas alcançadas em verde e as datas.

## Frontend para commitar (GitHub → Netlify CI)
Novos: src/lib/portal/{types,resultados}.ts, src/lib/api/{portalResultados,comentarios}.ts, src/components/portal/{ParcialFinalBadge,LaudosResultadosPanel,EvolucaoExemplares,TendenciaResistencia,ComentariosLaudo,LinhaTempoConcretagem}.tsx, src/pages/portal/PortalPublicoPage.tsx + (ref.) migrations 063–067 e EFs lab-client-portal/portal-anexo/notify-cliente-evento.
Alterados: src/App.tsx, src/lib/api/{portalCliente,clientUsers,laudo,concretagem,rompimento}.ts, src/pages/portal/{ClientePortalPage,ClienteUsuariosPage}.tsx, src/pages/concreto/{LaudosPage,ConcretagensPage,ConcretagemDetalhePage}.tsx, src/lib/telemetry/core.ts (v88), public/sw.js (v88) + (ref.) EFs generate-ficha-moldagem-pdf/extract-ficha-vision.

## Gate
check-source OK; revisões independentes (todas as etapas, incl. v88): SHIP, 0 must-fix. tsc/biome/vitest no Netlify CI.
Lembrete v85: alerta < fck envia e-mail real ao cliente (prod dispatch on) — confirme o 1º envio.
