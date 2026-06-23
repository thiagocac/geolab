# GEOLAB — SOURCE VERSION v28
CACHE_NAME: consultegeo-geolab-v28 · APP_VERSION: v28

Frontend (acumulado v2→v28): login + selecao de laboratorio + shell (v2) · Cadastros (v3) ·
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
integracao GEOMAT — rompimentos/controle-laudo/tracos (v28).

## v28 — Integracao GEOMAT (rompimentos + controle-laudo + tracos)
- Fork GPT/Claude mesclado no tronco v27 (preservando Estrutura, Colaboradores, validacao publica,
  numeracao, logo). NOVOS: lib/concreto/cp.ts + camposEnsaioLaudo.ts + lib/concreto.ts (calculo CP +
  catalogo de campos), ControleLaudoPage (campos do ensaio/laudo dinamicos, salva em config_lab).
  RompimentosPage estilo GEOMAT /concreto/controle/resultados (filtros, lote/linha, carga→MPa, XLSX,
  trilha, contraprova, numeracao lab). MateriaisPage com tracos ricos. Rotas /tracos e
  /gestao/controle-laudo. rompimento.ts superset (RPCs + fallback + maybeNotifyAbaixoFck).
- Backend (vivo): migration 027 (corpos_prova.numeracao_lab, RPCs lancar_rompimento_cp/
  lancar_situacao_cp/gerar_contraprova_cp/set_numeracao_cp) + 028 (revoga execute de anon/public;
  gate authenticated + is_tenant_writer).

## Backend (vivo via MCP em xbdvyvvxvzmcosnekmfv): migrations 001-028 (025 storage logo · 026
unit_link · 027 rompimento RPCs · 028 gate); ~10 EFs (PDF ficha + laudo v4, notificacao
send-notification/notify-event/resend-webhook, admin create-lab/invite-member, OCR
extract-laudo-vision, validacao publica validar-laudo); 5 buckets; e-mail em dry-run.
PENDENTE (via MCP): deploy do laudo EF v4 (NBR 12655 · fck,est) e generate-agenda-rompimento-pdf.

## Proximo: fechar a v1 (crons + CRON_SECRET, VISION_API_KEY do OCR, ligar e-mail real) e itens
v1.1 (medicao, portal do cliente, motor de NC, formas). Detalhe em docs/ · 07-backlog · 08-changelog.
