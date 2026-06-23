# GEOLAB — SOURCE VERSION v31
CACHE_NAME: consultegeo-geolab-v31 · APP_VERSION: v31

Frontend (acumulado v2→v31): login + selecao de laboratorio + shell (v2) · Cadastros (v3) ·
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
programacao + concretagem 2-etapas + campos dinamicos + Portal do Cliente (v29) ·
Brand Kit GEOLAB — fontes/simbolo/favicon/login (v30) ·
laudo dinamico v4 — toggles + paridade NBR + campos de cadastro (v31).

## v31 — Laudo dinamico (ligar toggles + paridade v4)
- Preferencias (config_lab): + Local de ensaios, ART do RT, Gerente da Qualidade, CREA do GQ.
- Tracos (operational_materials.componentes): sub-bloco Composicao — marca/procedencia do cimento,
  brita, areia, aditivo + agua.
- Rompimentos: sem mudanca (capeamento + prensa ja vinham de ensaio_campos).
- Backend (vivo): migration 031 (config_lab +local_ensaio/art_numero/gerente_qualidade/crea_gq;
  operational_materials.componentes jsonb) + EF generate-laudo-ensaio-pdf v4 — 5 toggles antes mortos
  LIGADOS (amostragem condicao A/B; contato=Solicitante; local_ensaio/incerteza; componentes) +
  paridade v4 (capeamento "Bases"; ART; 2a assinatura Gerente da Qualidade; legenda de normas).
- Build completo (check-source + tsc + vitest + vite) verde. Aplicado por cima da v30 (Brand Kit).

## Backend (vivo via MCP em xbdvyvvxvzmcosnekmfv): migrations 001-031 (025 storage logo · 026 unit_link ·
027 rompimento RPCs · 028 gate · 029 programacao/campos · 030 cliente isolation RLS · 031 laudo v4 campos);
EFs: PDF ficha + laudo v4 (toggles + paridade NBR 12655/fck,est), notificacao (send-notification/
notify-event/resend-webhook), admin (create-lab/invite-member/create-client-user), OCR
extract-laudo-vision, validacao publica validar-laudo, portal (portal-laudo-url ·
client-portal-submit-programacoes); 5 buckets; e-mail em dry-run.

## Proximo: fechar a v1 (crons + CRON_SECRET, VISION_API_KEY do OCR, ligar e-mail real,
generate-agenda-rompimento-pdf) e itens v1.1 (medicao, motor de NC, formas). Detalhe em docs/ ·
07-backlog · 08-changelog.
