# GEOLAB — SOURCE VERSION v21
CACHE_NAME: consultegeo-geolab-v21 · APP_VERSION: v21

Frontend (acumulado v2→v21): login + selecao de laboratorio + shell (v2) · Cadastros (v3) ·
Concretagem (v4) · Rompimentos — carga→MPa NBR 5739 (v5) · Laudos (v6) · gatilho de e-mail
laudo_pronto (v7) · hotfix login/config.js (v8) · Operacao Interna — usuarios + criar laboratorio
(v9) · Materiais e ensaios + padrao de moldagem (v10) · assistente Nova obra (v11) · Importacoes
em lote (v12) · evento resultado_abaixo_fck (v13) · Notificacoes/Preferencias do usuario (v14) ·
Painel/KPIs + Contratos (v15) · Importacao por OCR (v16) · Preferencias do laboratorio (v17) ·
CPs por caminhao no detalhe da concretagem (v18) · consistencia do fck do traco (v19) ·
fix disparo do evento laudo_pronto (v20) · revisao de UI/design — dark mode + responsivo (v21).

## v21 — Revisao de UI/design (dark mode + responsivo + tokens)
- Layout reescrito sobre o design system do styles.css: .app-shell + .sidebar (nav-sect/nav-link
  com barra de acento) + .topbar + .page-wrap; sidebar colapsa no mobile (botao de menu + scrim) e
  o theme-toggle (claro/escuro) usa o componente estilizado.
- Tokenizacao de cores (56 ocorrencias em 11 paginas + LoginScreen/AdminListPage): hex fixo → CSS
  var (--surface/--line/--ink/--ink-soft/--ink-faint/--magenta), entao as telas respondem ao dark
  mode; verde/ambar de status preservados. + .hide-sm (esconde e-mail no topbar mobile).

## Backend (vivo via MCP em xbdvyvvxvzmcosnekmfv): 22 migrations (001-022); EFs de PDF (ficha +
laudo v4), notificacao (send-notification · notify-event · resend-webhook), admin (create-lab ·
invite-member) e OCR (extract-laudo-vision, v16); 5 buckets; e-mail em dry-run.

## Proximo: fechar a v1 (crons + CRON_SECRET, VISION_API_KEY do OCR, ligar e-mail real) e itens
v1.1 (medicao, portal do cliente, motor de NC, formas). Detalhe em docs/ · 07-backlog · 08-changelog.
