# GEOLAB → Concresoft — SOURCE VERSION v39
CACHE_NAME: consultegeo-geolab-v39 · APP_VERSION: v39
(slug interno `consultegeo-geolab` mantido; marca visivel = **Concresoft**)

Frontend (acumulado v2→v39): login + selecao de laboratorio + shell (v2) · Cadastros (v3) ·
Concretagem (v4) · Rompimentos — carga→MPa NBR 5739 (v5) · Laudos (v6) · gatilho de e-mail
laudo_pronto (v7) · hotfix login/config.js (v8) · Operacao Interna (v9) · Materiais + padrao de
moldagem (v10) · assistente Nova obra (v11) · Importacoes em lote (v12) · evento resultado_abaixo_fck
(v13) · Notificacoes/Preferencias (v14) · Painel/KPIs + Contratos (v15) · Importacao por OCR (v16) ·
Preferencias do laboratorio (v17) · CPs por caminhao (v18) · consistencia do fck (v19) · fix
laudo_pronto (v20) · revisao de UI — dark mode + responsivo (v21) · validacao publica + numeracao
(v22) · Colaboradores + certificacoes (v23) · concretagem retroativa (v24) · logo do lab no laudo
(v25) · Estrutura da obra (v26) · peca na concretagem (v27) · integracao GEOMAT (v28) · Portal do
Cliente (v29) · Brand Kit (v30) · laudo dinamico v4 (v31) · rebrand de texto Concresoft (v32) ·
assets oficiais Concresoft (v33) · remove "Controle Tecnologico" do lockup + crons pg_cron (v34) ·
Medicao/faturamento v1.1 (v35) · Medicao: escopo + preco por tipo de ensaio + PDF de pre-fatura (v36) ·
lookup fiscal CNPJ/CEP via BrasilAPI (v37) · Formas — controle de moldes por obra (v38) ·
Estatistica de lote — aceitacao NBR 12655 (v39).

## v39 — Estatistica de lote (aceitacao NBR 12655)
- lib/api/lotes.ts + pages/concreto/LotesPage.tsx (NOVOS): aceitacao por **lote** (fcm, Sd, fck,est
  NBR 12655) alem da aceitacao por exemplar ja existente. Backend (vivo): migration 038
  (lotes_aceitacao_nbr12655).

### v34→v38 (incluidos neste salto a partir da v33)
- **v34** remove "Controle Tecnologico" ao lado da marca + habilita crons (migrations 032 pg_cron/pg_net,
  033 cron_schedules; EFs cron-watchdog/backup/digest/telemetria — ativas, ociosas ate CRON_SECRET).
- **v35/v36** Medicao/faturamento (v1.1): escopo + preco por tipo de ensaio + PDF de pre-fatura
  (lib/api/medicao.ts, pages/gestao/MedicaoPage.tsx, EF generate-medicao-pdf; migrations 034-036).
- **v37** lookup fiscal CNPJ/CEP via BrasilAPI (lib/api/fiscal.ts, EF consulta-fiscal; migration 037
  client_works_endereco_fiscal).
- **v38** Formas — controle logistico de moldes por obra (lib/api/formas.ts, pages/gestao/FormasPage.tsx).

## Backend (vivo via MCP em xbdvyvvxvzmcosnekmfv): migrations 001-038 (... 030 cliente isolation · 031
laudo v4 · 032 pg_cron · 033 cron_schedules · 034-036 medicao · 037 endereco fiscal · 038 lote NBR 12655);
**19 EFs ACTIVE**: PDF ficha + laudo v5 (Concresoft, NBR 12655/fck,est) + agenda-rompimento + medicao
(pre-fatura), notificacao (send-notification v2/notify-event/resend-webhook), admin (create-lab/
invite-member/create-client-user), OCR extract-laudo-vision, validar-laudo (publica), portal
(portal-laudo-url/client-portal-submit-programacoes), consulta-fiscal, crons (watchdog/backup/digest/
telemetria — ociosos ate CRON_SECRET); 5 buckets; e-mail em dry-run.

> Relatorios em PDF seguem `relatorios-ds.md` (raiz da pasta do projeto) como referencia de design.
> Rebrand: P1 texto + P3 EFs (v32) · P2 assets (v33) · "Controle Tecnologico" removido do lockup (v34).

## Proximo: **P4** dominio Concresoft (DNS+Netlify) + Resend (dominio + RESEND_FROM) — laudo/QR ainda
em `lab.consultegeo.org`. Setar **CRON_SECRET** (ativa os 4 crons), **VISION_API_KEY** (OCR), ligar
e-mail real. **P5** slugs internos (repo `thiagocac/geolab`, CACHE_NAME, package name). v1.1: motor de NC.
