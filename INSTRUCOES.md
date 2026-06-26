# INSTRUÇÕES — Release CONSOLIDADO v90 (portal + ficha + papéis do cliente) — UM push

Supersede v80–v89 (e os v88 colididos). Contém TODO o trabalho da sessão. **Um push** com os arquivos abaixo.

## Já aplicado por mim via MCP (NADA a fazer no Supabase)
Migrations: **063 · 064 · 065 · 066 · 067 · 068** (068 = papéis/permissões do cliente: members.portal_permissoes + current_member_pode + enforcement nas RPCs cancelar/comentar/contestar).
EFs: lab-client-portal v10 · portal-anexo **v2** (check anexar) · client-portal-submit-programacoes **v9** (check programar) · notify-cliente-evento v2 · generate-ficha-moldagem-pdf v12 · extract-ficha-vision v4.
EF da trilha paralela já live: generate-laudo-ensaio-pdf v15.

## Novidade v90 — Papéis do cliente + tela de configuração robusta (E2)
**Modelo de permissões por usuário do portal** (members.portal_permissoes jsonb; permissivo por padrão — só `false` explícito bloqueia, retrocompatível). Recursos: ver_resultados, baixar_laudo, programar, cancelar_programacao, anexar, comentar, contestar.
**Tela "Configurar acesso"** (Operação ▸ Usuários de clientes): **perfil** (Leitor / Operacional / Completo / Personalizado) + **toggles por recurso** + **obras visíveis**.
**Enforcement duplo:** o portal **esconde** recursos não liberados (aba Resultados, form de programação, cancelar, anexar, baixar PDF, comentar, contestar) **e** o backend recusa (RPCs + EFs checam a permissão).

## Frontend para commitar (GitHub → Netlify CI)
Novos desta etapa: `src/lib/api/portalPermissoes.ts`. Alterados: `src/lib/api/clientUsers.ts`, `src/pages/portal/ClienteUsuariosPage.tsx`, `src/pages/portal/ClientePortalPage.tsx`, `src/components/portal/{LaudosResultadosPanel,ComentariosLaudo}.tsx` + (ref.) migration 068 e EFs client-portal-submit-programacoes/portal-anexo. (+ tudo das etapas anteriores; ver lista completa abaixo no zip.)
Bump: src/lib/telemetry/core.ts (v90) + public/sw.js (v90).

## Gate
check-source OK; revisões independentes (todas as etapas, incl. v90): SHIP, 0 must-fix. tsc/biome/vitest no Netlify CI.
Lembrete: alerta < fck envia e-mail real ao cliente (prod dispatch on) — confirme o 1º envio.
