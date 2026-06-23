# GEOLAB — SOURCE VERSION v23
CACHE_NAME: consultegeo-geolab-v23 · APP_VERSION: v23

Frontend (acumulado v2→v23): login + selecao de laboratorio + shell (v2) · Cadastros (v3) ·
Concretagem (v4) · Rompimentos — carga→MPa NBR 5739 (v5) · Laudos (v6) · gatilho de e-mail
laudo_pronto (v7) · hotfix login/config.js (v8) · Operacao Interna — usuarios + criar laboratorio
(v9) · Materiais e ensaios + padrao de moldagem (v10) · assistente Nova obra (v11) · Importacoes
em lote (v12) · evento resultado_abaixo_fck (v13) · Notificacoes/Preferencias do usuario (v14) ·
Painel/KPIs + Contratos (v15) · Importacao por OCR (v16) · Preferencias do laboratorio (v17) ·
CPs por caminhao no detalhe da concretagem (v18) · consistencia do fck do traco (v19) ·
fix disparo do evento laudo_pronto (v20) · revisao de UI/design — dark mode + responsivo (v21) ·
validacao publica de laudo + numeracao da concretagem (v22) · Colaboradores + certificacoes (v23).

## v23 — Colaboradores + certificacoes
- colaboradores.ts + ColaboradoresPage.tsx (NOVOS): cadastro de colaborador gerencia certificacoes
  (NBR 15146-1/2, CREA/CRQ/TER) com numero e validade, e mostra chip de validade (valida / vence em
  ≤30d / vencida). CadastrosPage: aba Colaboradores agora usa a pagina custom (saiu do AdminListPage).
- Sem backend novo (tabela colaborador_certificacoes ja existe, migration 005; RLS por tenant).

## Backend (vivo via MCP em xbdvyvvxvzmcosnekmfv): 23 migrations (001-023); EFs de PDF (ficha +
laudo v4), notificacao (send-notification · notify-event · resend-webhook), admin (create-lab ·
invite-member), OCR (extract-laudo-vision, v16) e validacao publica (validar-laudo, v22); 5 buckets;
e-mail em dry-run.

## Proximo: fechar a v1 (crons + CRON_SECRET, VISION_API_KEY do OCR, ligar e-mail real) e itens
v1.1 (medicao, portal do cliente, motor de NC, formas). Detalhe em docs/ · 07-backlog · 08-changelog.
