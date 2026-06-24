# GEOLAB → Concresoft — SOURCE VERSION v55
CACHE_NAME: consultegeo-geolab-v55 · APP_VERSION: v55
(slug interno `consultegeo-geolab` mantido; marca visivel = **Concresoft**)

Frontend (acumulado v2→v55): …Portal do Cliente (v29) · Brand Kit (v30) · laudo dinamico v4 (v31) ·
rebrand Concresoft texto+assets (v32-v33) · remove "Controle Tecnologico" + crons (v34) · Medicao/
faturamento v1.1 (v35-v36) · lookup fiscal CNPJ/CEP (v37) · Formas (v38) · Estatistica de lote NBR
12655 (v39) · Motor de NC — engine + Fase C (v40-v44) · laudo↔lote fck,est (v45) · Formas→Medicao
cobranca automatica (v46) · OCR de DANFE/NF (v47) · Relatorios de produtividade (v48) · Financeiro:
faturamento sobre a medicao (v49) · **code-splitting por rota + xlsx lazy (v50)** · **Biome lint no
gate de build (v51)** · **versao automatica na UI (v52)** · **React 18.3→19.2 (v53)** · **React
Compiler 1.0 — memoizacao automatica (v54)** · **rolldown-vite 7.3.1 — bundler Rust (v55)**.
(historico completo v2→v29 em git log + 08-changelog.)

## v50→v55 — Toolchain / build (sem mudanca de feature)
- **v50** code-splitting por rota (React.lazy/Suspense) + `xlsx` carregado sob demanda (chunk isolado
  ~425kB lazy; vendor ~182kB).
- **v51** Biome no toolchain — gate de build agora: `check-source && biome lint src && tsc --noEmit &&
  vitest run && vite build`. (removidos imports nao usados em validar.ts/telemetry).
- **v52** versao na UI automatica — o rodape passa a ler `APP_VERSION` (fim do "Concresoft vNN" hardcoded
  defasado).
- **v53** React 18.3 → **19.2** (Fase 1 conservadora; createRoot+StrictMode mantidos; react-router v6.30.4).
- **v54** **React Compiler 1.0** (memoizacao automatica; babel-plugin-react-compiler no vite.config; ~815
  memo-slots no chunk).
- **v55** **rolldown-vite 7.3.1** — `"vite": "npm:rolldown-vite@^7.3.1"` (drop-in; bundler Rust Rolldown/Oxc;
  config/plugins inalterados; vitest segue com vite@5 aninhado). Proximo (v56): Vite 8 nativo.

## Backend (vivo via MCP em xbdvyvvxvzmcosnekmfv; estado conforme PK): migrations **001-048**; **22 EFs
ACTIVE** — PDF ficha **v3** + laudo **v7** (aceitacao estatistica de lote NBR 12655; auto-match obra+fck
ou lote_id) + agenda-rompimento + medicao, notificacao (send-notification/notify-event/resend-webhook),
admin (create-lab/invite-member/create-client-user), OCR (extract-laudo-vision + extract-nf-vision),
validar-laudo (publica), portal (portal-laudo-url/client-portal-submit-programacoes + **lab-client-portal**
magic link), consulta-fiscal, 5 crons (ociosos ate CRON_SECRET); NC engine ligado; e-mail em dry-run.

## Proximo: **migracao de dominio** em curso → app em `app.concresoft.io` (mesmo site Netlify geo-labs;
`lab.consultegeo.org` como alias) + Resend por `concresoft.io` — ver `GEOLAB-Migracao-Dominio-app.concresoft.io.md`.
Setar **CRON_SECRET**, **VISION_API_KEY**, ligar e-mail real. **P5** slugs internos. v56: Vite 8 nativo.
