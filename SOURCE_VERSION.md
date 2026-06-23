# GEOLAB → Concresoft — SOURCE VERSION v32
CACHE_NAME: consultegeo-geolab-v32 · APP_VERSION: v32
(slug interno `consultegeo-geolab` mantido; marca visivel agora = **Concresoft**)

Frontend (acumulado v2→v32): login + selecao de laboratorio + shell (v2) · Cadastros (v3) ·
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
Brand Kit (v30) · laudo dinamico v4 (v31) · rebrand de texto para Concresoft (v32).

## v32 — Rebrand de texto (Consulte GEO / GEOLAB / GEOMAT → Concresoft)
- Todo texto visivel trocado para **Concresoft**, mantendo o sistema visual do brand kit (simbolo de
  3 barras, paleta navy/roxo/magenta + gradiente, Mona Sans/JetBrains Mono): index.html title,
  manifest (name/short_name), Layout (sidebar + rodape), LoginScreen (nome + rodape), DashboardPage,
  ValidarPage, OperacaoPage, MateriaisPage (remove GEOMAT); aria-labels e lockups SVG → Concresoft.
- Backend/EFs rebrandeadas (deploy via MCP): generate-laudo-ensaio-pdf **v5** (wordmark Concresoft) +
  send-notification **v2** (subject [Concresoft], wordmark/remetente do e-mail).
- Dominio `lab.consultegeo.org` MANTIDO (laudo/ficha/QR) — troca quando houver dominio Concresoft.
- Slug interno (repo `thiagocac/geolab`, CACHE_NAME `consultegeo-geolab`) inalterado.

Fases do rebrand: **P1 texto (v32) feito** · **P3 EFs (laudo v5 / send-notification v2) feito** ·
P2 assets oficiais `concresoft-*.svg` = v33 · P4 (Thiago) dominio + Resend · P5 slugs internos (opcional).

## Backend (vivo via MCP em xbdvyvvxvzmcosnekmfv): migrations 001-031 (... 030 cliente isolation ·
031 laudo v4 campos); EFs: PDF ficha + laudo **v5** (Concresoft, toggles + paridade NBR 12655),
notificacao **send-notification v2 (Concresoft)** / notify-event / resend-webhook, admin
(create-lab/invite-member/create-client-user), OCR extract-laudo-vision, validacao publica
validar-laudo, portal (portal-laudo-url · client-portal-submit-programacoes); 5 buckets; e-mail dry-run.

## Proximo: assets oficiais Concresoft (v33); P4 dominio Concresoft + Resend; fechar a v1 (crons +
CRON_SECRET, VISION_API_KEY, ligar e-mail real, generate-agenda-rompimento-pdf); v1.1 (medicao, NC, formas).
