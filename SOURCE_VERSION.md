# GEOLAB — SOURCE VERSION v30
CACHE_NAME: consultegeo-geolab-v30 · APP_VERSION: v30

Frontend (acumulado v2→v30): login + selecao de laboratorio + shell (v2) · Cadastros (v3) ·
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
Brand Kit GEOLAB — fontes/simbolo/favicon/login (v30).

## v30 — Brand Kit GEOLAB (identidade da marca)
- Fontes self-hosted (public/fonts): Mona Sans (variavel, display/corpo) + JetBrains Mono
  (numerais/kickers/labels). @font-face em styles.css; font-family da marca no body e mono nas labels
  (.kicker · .nav-sect · .table th).
- Tokens: --grad-brand (linear-gradient 135deg · #182863 0% · #3E2D71 55% · #C5117E 100%) em
  .btn-primary / .sidebar-brand / login; + --magenta-light (#E8459E). Paleta navy/purple/magenta e
  paper (#FAF9F7) ja batiam com a marca.
- Simbolo "C" de 3 barras (oficial) na sidebar e no login; SVGs oficiais em public/brand/
  (symbol/lockup/appicon/favicon nas variantes cor/gradiente/navy/branco).
- index.html: favicon (public/favicon.svg) + apple-touch-icon + meta theme-color + link do manifest.
- PWA manifest corrigido: nome "GEOLAB — Controle Tecnologico" (era "Consulte GEO Materiais", herdado
  do fork GEOMAT) + icones (app icon SVG).
- LoginScreen redesenhada (split-panel da marca): painel gradiente (simbolo + wordmark + tagline +
  assinatura mono) e card de acesso (kicker mono + Mona Sans). Preserva o fluxo de auth — sem <form>,
  submit por Enter/botao, mesmos Field/Button/useAuth.
- Build completo (check-source + tsc + vitest + vite) verde. Sem backend novo. Origem: handoff
  "GEOLAB Brand Kit" (Claude Design). Aplicado por cima da v29 (Portal do Cliente).

## Backend (vivo via MCP em xbdvyvvxvzmcosnekmfv): migrations 001-030 (025 storage logo · 026 unit_link ·
027 rompimento RPCs · 028 gate · 029 programacao/campos · 030 cliente isolation RLS); EFs: PDF ficha +
laudo (campos dinamicos, texto v4), notificacao (send-notification/notify-event/resend-webhook), admin
(create-lab/invite-member/create-client-user), OCR extract-laudo-vision, validacao publica validar-laudo,
portal (portal-laudo-url · client-portal-submit-programacoes); 5 buckets; e-mail em dry-run.

## Proximo: fechar a v1 (crons + CRON_SECRET, VISION_API_KEY do OCR, ligar e-mail real) e itens
v1.1 (medicao, motor de NC, formas). Detalhe em docs/ · 07-backlog · 08-changelog.
