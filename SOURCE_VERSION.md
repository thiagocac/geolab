# GEOLAB — SOURCE VERSION v22
CACHE_NAME: consultegeo-geolab-v22 · APP_VERSION: v22

Frontend (acumulado v2→v22): login + selecao de laboratorio + shell (v2) · Cadastros (v3) ·
Concretagem (v4) · Rompimentos — carga→MPa NBR 5739 (v5) · Laudos (v6) · gatilho de e-mail
laudo_pronto (v7) · hotfix login/config.js (v8) · Operacao Interna — usuarios + criar laboratorio
(v9) · Materiais e ensaios + padrao de moldagem (v10) · assistente Nova obra (v11) · Importacoes
em lote (v12) · evento resultado_abaixo_fck (v13) · Notificacoes/Preferencias do usuario (v14) ·
Painel/KPIs + Contratos (v15) · Importacao por OCR (v16) · Preferencias do laboratorio (v17) ·
CPs por caminhao no detalhe da concretagem (v18) · consistencia do fck do traco (v19) ·
fix disparo do evento laudo_pronto (v20) · revisao de UI/design — dark mode + responsivo (v21) ·
validacao publica de laudo + numeracao da concretagem (v22).

## v22 — Validacao publica de laudo + numeracao da concretagem
- ValidarPage.tsx + validar.ts (NOVOS): pagina publica /validar/:codigo (fora do gate de auth, sem
  Layout) que chama a EF validar-laudo (so anon key) e mostra a autenticidade do laudo (numero,
  status, data, lab, RT, revisao) a partir do QR LAU-<codigo>. App.tsx: rota fora do gate de auth.
- Backend (vivo): migration 023 (trigger set_concretagem_codigo gera CONC-AAAA-NNNNNN por tenant/ano
  + indice unico) e EF validar-laudo (publica, verify_jwt=false, service-role, so info de autenticidade).

## Backend (vivo via MCP em xbdvyvvxvzmcosnekmfv): 23 migrations (001-023); EFs de PDF (ficha +
laudo v4), notificacao (send-notification · notify-event · resend-webhook), admin (create-lab ·
invite-member), OCR (extract-laudo-vision, v16) e validacao publica (validar-laudo, v22); 5 buckets;
e-mail em dry-run.

## Proximo: fechar a v1 (crons + CRON_SECRET, VISION_API_KEY do OCR, ligar e-mail real) e itens
v1.1 (medicao, portal do cliente, motor de NC, formas). Detalhe em docs/ · 07-backlog · 08-changelog.
