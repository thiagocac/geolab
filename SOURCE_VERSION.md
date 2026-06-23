# GEOLAB — SOURCE VERSION v18
CACHE_NAME: consultegeo-geolab-v18 · APP_VERSION: v18

Frontend (acumulado v2→v18): login + selecao de laboratorio + shell (v2) · Cadastros (v3) ·
Concretagem (v4) · Rompimentos — carga→MPa NBR 5739 (v5) · Laudos (v6) · gatilho de e-mail
laudo_pronto (v7) · hotfix login/config.js (v8) · Operacao Interna — usuarios + criar laboratorio
(v9) · Materiais e ensaios + padrao de moldagem (v10) · assistente Nova obra (v11) · Importacoes
em lote (v12) · evento resultado_abaixo_fck (v13) · Notificacoes/Preferencias do usuario (v14) ·
Painel/KPIs + Contratos (v15) · Importacao por OCR (v16) · Preferencias do laboratorio (v17) ·
CPs por caminhao no detalhe da concretagem (v18).

## v18 — Detalhe da concretagem: Caminhoes + CPs
- lib/api/concretagem.ts: + listCpsDaConcretagem (CPs + resultado via embed material_tests).
- ConcretagemDetalhePage: lista os CPs sob cada caminhao (codigo, idade, situacao pendente/rompido
  e o MPa quando rompido); invalida ao adicionar caminhao.

## Backend (vivo via MCP em xbdvyvvxvzmcosnekmfv): 22 migrations (001-022); EFs de PDF (ficha +
laudo v4), notificacao (send-notification · notify-event · resend-webhook), admin (create-lab ·
invite-member) e OCR (extract-laudo-vision, v16); 5 buckets; e-mail em dry-run.

## Proximo: fechar a v1 (crons + CRON_SECRET, VISION_API_KEY do OCR, ligar e-mail real) e itens
v1.1 (medicao, portal do cliente, motor de NC, formas). Detalhe em docs/ · 07-backlog · 08-changelog.
