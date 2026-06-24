# GEOLAB → Concresoft — SOURCE VERSION v49
CACHE_NAME: consultegeo-geolab-v49 · APP_VERSION: v49
(slug interno `consultegeo-geolab` mantido; marca visivel = **Concresoft**)

Frontend (acumulado v2→v49): login + selecao de laboratorio + shell (v2) · Cadastros (v3) ·
Concretagem (v4) · Rompimentos NBR 5739 (v5) · Laudos (v6) · gatilho e-mail laudo_pronto (v7) ·
hotfix login (v8) · Operacao Interna (v9) · Materiais + padrao de moldagem (v10) · Nova obra (v11) ·
Importacoes em lote (v12) · evento resultado_abaixo_fck (v13) · Notificacoes/Preferencias (v14) ·
Painel/KPIs + Contratos (v15) · Importacao por OCR (v16) · Preferencias do lab (v17) · CPs por
caminhao (v18) · consistencia do fck (v19) · fix laudo_pronto (v20) · UI dark mode + responsivo (v21) ·
validacao publica + numeracao (v22) · Colaboradores + certificacoes (v23) · concretagem retroativa
(v24) · logo do lab no laudo (v25) · Estrutura da obra (v26) · peca na concretagem (v27) · integracao
GEOMAT (v28) · Portal do Cliente (v29) · Brand Kit (v30) · laudo dinamico v4 (v31) · rebrand de texto
Concresoft (v32) · assets oficiais Concresoft (v33) · remove "Controle Tecnologico" + crons (v34) ·
Medicao/faturamento v1.1 (v35) · Medicao: escopo+preco+PDF pre-fatura (v36) · lookup fiscal CNPJ/CEP
(v37) · Formas (v38) · Estatistica de lote NBR 12655 (v39) · Motor de NC — engine + Fase C (v40-v44) ·
laudo↔lote fck,est no laudo (v45) · Formas→Medicao cobranca automatica (v46) · OCR de DANFE/NF (v47) ·
Relatorios de produtividade (v48) · Financeiro: faturamento sobre a medicao (v49).

## v49 — Financeiro: faturamento (emissao / baixa) sobre a medicao
- Emissao de fatura a partir da medicao (pre-fatura) + baixa (pagamento); fluxo financeiro sobre
  `medicoes`. (Detalhe operacional no INSTRUCOES do patch v49 e no 07-backlog/08-changelog.)

### v40→v48 (incluidos neste salto a partir da v39)
- **v40-v44 — Motor de NC ligado** (antes DB-ready/desligado, migration 017 nc_ready): engine
  configuravel (v40) · mais gatilhos automaticos (v41) · telas de configuracao (v42) · grafo de
  transicoes + anexos (storage policy `nc_anexos_rw`) + CP atrasado→NC (v43) · autoconclusao por
  tolerancia + e-mail de NC / cron-nc-digest (v44). Telas NcPage/NcConfigPage; nc.ts/ncConfig.ts.
- **v45 — Laudo ↔ Lote:** a EF do laudo (v6) faz auto-match de `lotes_aceitacao` (mesma obra + fck,
  mais recente) ou aceita `lote_id` explicito → imprime fck,est estatistico (NBR 12655); cai p/
  por-exemplar honesto sem lote.
- **v46 — Formas → Medicao:** cobranca automatica de formas na medicao.
- **v47 — OCR de DANFE/NF por caminhao:** EF `extract-nf-vision` (foto ou NF-e XML → campos do
  recebimento; fail-safe sem `VISION_API_KEY`).
- **v48 — Relatorios de produtividade.**

## Backend (vivo via MCP em xbdvyvvxvzmcosnekmfv): migrations **001-047**; **21 EFs ACTIVE** — PDF ficha
+ laudo **v6** (aceitacao estatistica de lote NBR 12655 fcm/Sd/fck,est, auto-match por obra+fck ou
lote_id) + agenda-rompimento + medicao (pre-fatura), notificacao (send-notification v2/notify-event/
resend-webhook), admin (create-lab/invite-member/create-client-user), OCR (extract-laudo-vision +
**extract-nf-vision**), validar-laudo (publica), portal (portal-laudo-url/client-portal-submit-programacoes),
consulta-fiscal, crons (watchdog/backup/digest/telemetria/**nc-digest** — ociosos ate CRON_SECRET);
5 buckets; e-mail em dry-run. NC engine agora **ligado**.

> Relatorios em PDF seguem `relatorios-ds.md` (raiz da pasta do projeto) como referencia de design.

## Proximo: **P4** dominio Concresoft (DNS+Netlify) + Resend (dominio + RESEND_FROM) — laudo/QR ainda
em `lab.consultegeo.org`. Setar **CRON_SECRET** (ativa os 5 crons), **VISION_API_KEY** (OCR laudo+NF),
ligar e-mail real. **P5** slugs internos (repo `thiagocac/geolab`, CACHE_NAME, package name).
