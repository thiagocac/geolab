# GEOLAB → Concresoft — SOURCE VERSION v33
CACHE_NAME: consultegeo-geolab-v33 · APP_VERSION: v33
(slug interno `consultegeo-geolab` mantido; marca visivel = **Concresoft**)

Frontend (acumulado v2→v33): login + selecao de laboratorio + shell (v2) · Cadastros (v3) ·
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
integracao GEOMAT (v28) · programacao + Portal do Cliente (v29) · Brand Kit (v30) ·
laudo dinamico v4 (v31) · rebrand de texto para Concresoft (v32) · assets oficiais Concresoft (v33).

## v33 — Assets oficiais do brand kit Concresoft
- `public/brand/geolab-*.svg` → **`concresoft-*.svg`** (symbol/lockup/appicon/favicon oficiais;
  aria-label "Concresoft", lockup com wordmark "Concresoft"). `public/favicon.svg` → favicon oficial
  Concresoft. `manifest.webmanifest` + `index.html` → refs de icone para `concresoft-appicon.svg`.
  **Removidos** os 8 `geolab-*.svg` antigos.
- Mesmo sistema visual (paleta navy/roxo/magenta + gradiente, simbolo de 3 barras, Mona Sans/JetBrains
  Mono) — muda so o nome e os arquivos. Sem backend novo (EFs ja em laudo v5 / send-notification v2).

Fases do rebrand: **P1 texto (v32) ✓ · P3 EFs laudo v5/send-notification v2 (v32) ✓ · P2 assets
oficiais concresoft-*.svg (v33) ✓** · P4 (Thiago) dominio Concresoft + Resend · P5 slugs internos
(repo/CACHE_NAME/package — opcional).

## Backend (vivo via MCP em xbdvyvvxvzmcosnekmfv): migrations 001-031 (... 030 cliente isolation ·
031 laudo v4 campos); EFs: PDF ficha + laudo **v5** (Concresoft, toggles + paridade NBR 12655),
**send-notification v2 (Concresoft)** / notify-event / resend-webhook, admin
(create-lab/invite-member/create-client-user), OCR extract-laudo-vision, validacao publica
validar-laudo, portal (portal-laudo-url · client-portal-submit-programacoes); 5 buckets; e-mail dry-run.

## Proximo: **P4** dominio Concresoft (DNS+Netlify) + Resend (dominio + RESEND_FROM) — hoje o laudo/QR
ainda usa `lab.consultegeo.org`. Fechar a v1 (crons + CRON_SECRET, VISION_API_KEY, ligar e-mail real,
generate-agenda-rompimento-pdf). v1.1: medicao, motor de NC, formas. P5: slugs internos.
