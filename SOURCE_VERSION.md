# GEOLAB — SOURCE VERSION v27
CACHE_NAME: consultegeo-geolab-v27 · APP_VERSION: v27

Frontend (acumulado v2→v27): login + selecao de laboratorio + shell (v2) · Cadastros (v3) ·
Concretagem (v4) · Rompimentos — carga→MPa NBR 5739 (v5) · Laudos (v6) · gatilho de e-mail
laudo_pronto (v7) · hotfix login/config.js (v8) · Operacao Interna — usuarios + criar laboratorio
(v9) · Materiais e ensaios + padrao de moldagem (v10) · assistente Nova obra (v11) · Importacoes
em lote (v12) · evento resultado_abaixo_fck (v13) · Notificacoes/Preferencias do usuario (v14) ·
Painel/KPIs + Contratos (v15) · Importacao por OCR (v16) · Preferencias do laboratorio (v17) ·
CPs por caminhao no detalhe da concretagem (v18) · consistencia do fck do traco (v19) ·
fix disparo do evento laudo_pronto (v20) · revisao de UI/design — dark mode + responsivo (v21) ·
validacao publica de laudo + numeracao da concretagem (v22) · Colaboradores + certificacoes (v23) ·
concretagem retroativa (v24) · upload de logo do laboratorio no laudo (v25) ·
Estrutura da obra — Grupos/Tipos/Pecas (v26) · peca da estrutura na concretagem (v27).

## v27 — Wiring da peca na concretagem
- estrutura.ts: + listPecasObra (pecas ativas da obra, label amigavel). ConcretagensPage: na Nova
  concretagem, se a obra tem pecas (Estrutura), aparece o seletor Peca → grava concretagens.unit_id
  e popula local_texto com o nome da peca (laudo/ficha ja imprimem); reset de unit_id ao trocar obra.
- Backend (vivo): migration 026_concretagem_unit_link — concretagens.unit_id uuid (FK units, nullable)
  + indice. Aditivo.

## Backend (vivo via MCP em xbdvyvvxvzmcosnekmfv): migrations 001-023 + 025 (storage logo) + 026
(unit_link); EFs de PDF (ficha + laudo v4), notificacao (send-notification · notify-event ·
resend-webhook), admin (create-lab · invite-member), OCR (extract-laudo-vision, v16) e validacao
publica (validar-laudo, v22); 5 buckets; e-mail em dry-run.

## Proximo: fechar a v1 (crons + CRON_SECRET, VISION_API_KEY do OCR, ligar e-mail real) e itens
v1.1 (medicao, portal do cliente, motor de NC, formas). Detalhe em docs/ · 07-backlog · 08-changelog.
