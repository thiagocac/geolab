# GEOLAB — SOURCE VERSION v29
CACHE_NAME: consultegeo-geolab-v29 · APP_VERSION: v29

Frontend (acumulado v2→v29): login + selecao de laboratorio + shell (v2) · Cadastros (v3) ·
Concretagem (v4) · Rompimentos — carga→MPa NBR 5739 (v5) · Laudos (v6) · gatilho de e-mail
laudo_pronto (v7) · hotfix login/config.js (v8) · Operacao Interna — usuarios + criar laboratorio
(v9) · Materiais e ensaios + padrao de moldagem (v10) · assistente Nova obra (v11) · Importacoes
em lote (v12) · evento resultado_abaixo_fck (v13) · Notificacoes/Preferencias do usuario (v14) ·
Painel/KPIs + Contratos (v15) · Importacao por OCR (v16) · Preferencias do laboratorio (v17) ·
CPs por caminhao no detalhe da concretagem (v18) · consistencia do fck do traco (v19) ·
fix disparo do evento laudo_pronto (v20) · revisao de UI/design — dark mode + responsivo (v21) ·
validacao publica de laudo + numeracao da concretagem (v22) · Colaboradores + certificacoes (v23) ·
concretagem retroativa (v24) · upload de logo do laboratorio no laudo (v25) ·
Estrutura da obra — Grupos/Tipos/Pecas (v26) · peca da estrutura na concretagem (v27) ·
integracao GEOMAT — rompimentos/controle-laudo/tracos (v28) ·
programacao + concretagem 2-etapas + campos dinamicos + Portal do Cliente (v29).

## v29 — Programacao + campos dinamicos + Portal do Cliente
- Frontend: concretagem em 2 etapas (ConcretagemDetalhePage), ProgramacoesPage (fila do lab),
  CamposConcretagemPage/CamposRecebimentoPage (toggles dinamicos), MoldingStandardEditor. Portal do
  Cliente: ClientePortalPage (grid de programacao→EF, consulta de concretagens/laudos, download via EF
  segura) + ClienteUsuariosPage (criar usuario cliente + vincular obras). Rotas /programacoes,
  /gestao/campos-recebimento, /gestao/campos-concretagem, /portal-cliente, /portal/usuarios-clientes.
- Backend (vivo): migration 029 (config_lab.concretagem_campos, member_obras.deleted_at, defaults de
  campos, helper member_can_access_work) + 030 (isolamento do papel cliente: is_tenant_member exclui
  cliente, leituras escopadas por obra via member_can_access_work). EFs NOVAS: portal-laudo-url
  (download de laudo escopado, service-role), admin-create-client-user, client-portal-submit-programacoes.
  generate-laudo/ficha com campos dinamicos + texto v4 (NBR 12655/fck,est).

## Backend (vivo via MCP em xbdvyvvxvzmcosnekmfv): migrations 001-030 (025 storage logo · 026 unit_link ·
027 rompimento RPCs · 028 gate · 029 programacao/campos · 030 cliente isolation RLS); EFs: PDF ficha +
laudo (campos dinamicos, texto v4), notificacao (send-notification/notify-event/resend-webhook), admin
(create-lab/invite-member/create-client-user), OCR extract-laudo-vision, validacao publica validar-laudo,
portal (portal-laudo-url · client-portal-submit-programacoes); 5 buckets; e-mail em dry-run.

## Proximo: fechar a v1 (crons + CRON_SECRET, VISION_API_KEY do OCR, ligar e-mail real) e itens
v1.1 (medicao, motor de NC, formas). Detalhe em docs/ · 07-backlog · 08-changelog.
