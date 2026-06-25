# GEOLAB → Concresoft — SOURCE VERSION v83
CACHE_NAME: consultegeo-geolab-v83 · APP_VERSION: v83
(slug interno `consultegeo-geolab` mantido; marca visivel = **Concresoft**; app em `app.concresoft.io`)

Frontend (acumulado v2→v83): …Brand Kit (v30) · Motor de NC (v40-v44) · Financeiro (v49) ·
code-splitting (v50) · React 18→19 (v53) · React Compiler (v54) · rolldown-vite (v55) · Vite 8 +
vitest 3 (v56) · Zod 4 (v57) · Observabilidade (v58) · backend aplicado + tipos reais (v59) ·
Tailwind CSS v4 + OKLCH (v60) · tipografia editorial + motion (v61) · View Transitions (v62) ·
Base UI + ConfirmDialog (v63) · Cadastro em Drawer (v64) · Validacao RHF + Zod (v65) · Modal -> Base UI
Dialog a11y (v66) · "Nova programacao" dedicada (v67) · Tooltip (v68) · ⌘K Command Palette (v69) ·
paste-to-fill (v70) · TanStack Table + Virtual (v71) · UX dos modais de cadastro (v72, v76) · Recharts na
Observabilidade (v73) · correcoes auditoria v60→v73 (v74) · "Tipos de ensaio" (v75) · Reconciliacao
modernizacao+dominio (v77) · icones do menu lateral (v78) · SPA fallback (v79) · revisao da emissao/abertura
de PDFs (v80-A) · Portal do cliente — abas/Parcial-Final/resultados/Excel (v80-B) · 12 melhorias do portal (v81) ·
Ficha de moldagem Modelo A — em branco/pre-preenchida/OCR (v82) · release consolidado portal+ficha (v83).
(historico v2→v49 em git log.)

## ⚠️ DUAS v80 + branch divergente do pipeline (v80-B…v83) — resolvido por MERGE (ler antes de mexer)
O pipeline gerou DOIS releases rotulados "v80" e seguiu num **branch a partir da v79 que NUNCA reincorporou o `pdf.ts`**:
- **v80-A "Revisao de PDFs"** (commit `dc244ff`, JA NO AR): util `src/lib/pdf.ts` + fix de popup-blocker.
- **v80-B "Portal"** · **v81 "12 melhorias"** · **v82 "Ficha de moldagem"** · **v83 "consolidado"** — TODOS gerados
  **sem** o `pdf.ts` (completos branchados da v79). Decisao (Thiago): **manter tudo** (MERGE); numeracao "2a v80 + v81 + v82 + v83".
- **MERGE manual** — re-aplicar o padrao da revisao de PDF sobre as versoes do branch, nos arquivos que os dois fluxos tocam:
  - `src/lib/api/laudo.ts` — `downloadUrl(path, filename?)` + `{ download }`.
  - `src/pages/concreto/LaudosPage.tsx` — `openDeferredTab`/`saveUrl`/`blobUrlAutoRevoke` (preview/gerar/baixar).
  - `src/pages/portal/ClientePortalPage.tsx` — `openDeferredTab` em `abrir` e `baixarAnexo`.
  - `src/pages/concreto/ConcretagensPage.tsx` (v82/v83) — `import { saveBlob as dl } from '../../lib/pdf'` no lugar do `dl` local.
  `pdf.ts` + os outros arquivos da revisao de PDF (medicao/nc/ConcretagemDetalhe/NcPage/Programacoes/Rompimentos/Medicao) preservados.
- **NAO reconciliar com o completo** desses zips (reverteria o `pdf.ts`). O `diff -rq` vs completo mostra DE PROPOSITO
  ~12 arquivos de PDF + `pdf.ts` divergentes — isso e o esperado. **Quando o pipeline finalmente shipar com `pdf.ts`
  (`test -f completo/src/lib/pdf.ts` = SIM), o merge manual deixa de ser necessario.**

## v60→v83 — design/UX + robustez + portal do cliente + ficha de moldagem
- **Fase 2-5 (v60-v78):** Tailwind v4/OKLCH · Base UI · ⌘K/paste-to-fill/TanStack · Recharts · "Tipos de ensaio" · icones do menu.
- **v79 — SPA fallback:** `public/_redirects` — fix do 404 ao recarregar/deep-link.
- **v80-A — Robustez de PDFs:** util `src/lib/pdf.ts` + refator dos pontos que abrem/baixam PDF. Migration 062 (`lab_laudos_read`, LIVE).
- **v80-B — Portal do cliente:** abas (Programacao / Resultados & Laudos) · Parcial/Final · resultados inline · Excel ·
  acesso por link sem senha · rota `/portal/acesso/:token`. Migration 063 + EF `lab-client-portal` v8 LIVE.
- **v81 — 12 melhorias do portal:** evolucao de exemplares, anexos do cliente, classificacao de laudos. Migration 064 LIVE.
- **v82 — Ficha de moldagem Modelo A:** ficha em branco + pre-preenchida (da programacao) + OCR. EFs `generate-ficha-moldagem-pdf`
  + `extract-ficha-vision` ja deployadas; **sem migration nova**.
- **v83 — Release CONSOLIDADO:** portal (v80-B/v81) + ficha (v82) "tudo num push so". (Aqui ja estavam incrementais; v83 = bump + consolidacao.)
- Build verde: check-source · biome 0 · tsc 0 · vitest · Vite 8.1 (Rolldown/Oxc). Deps: base-ui/rhf/tanstack/recharts.

## E-mail transacional — Concresoft Email Kit (fora do pipeline)
- Template "bulletproof" nos 2 unicos senders Resend: **`send-notification` v10** (hub) e **`enviar-laudo-cliente` v5**
  (laudo PDF anexado). Lockup PNG `public/brand/concresoft-lockup-{white,color}-2x.png` — **repo-only, preservar**.
- 27 EFs auditadas: cobertura TOTAL. `telemetry-alarm` v4 corrigida; e-mail de alertas LIGADO. **REGRA FIXA: e-mail novo usa
  o Kit** (PK §3). Detalhes na memoria geolab-email-architecture.

## Backend / infra (estado vivo; FONTE CANONICA = GEOLAB-Project-Knowledge.md)
- **Migrations: 64 aplicadas** (todas LIVE). 062 `lab_laudos_read` · 063 `portal_resultados_parcial_final` · 064
  `portal_melhorias_classificacao_magiclink`. v82/v83 (ficha) = EFs ja deployadas, sem migration nova. 66 tabelas · **27 EFs** · **13 crons**.
- **E-mail real LIGADO**: `dispatch_enabled=true`, `dry_run=false`, **allowlist ABERTA**. `telemetry_settings.alert_notify_email=true`.
  Secrets `CRON_SECRET`/`RESEND_*`/`VISION_API_KEY` ✅.
- Stack: React 19.2 + Compiler · Vite 8.1 · vitest 3 · Biome 2.5 · Zod 4 · Tailwind 4 · Base UI · RHF · TanStack Table + Virtual · Recharts.

## Proximo: continuar portal do cliente / ficha de moldagem. Piloto aberto.

> Nota: SOURCE_VERSION do pipeline vem stale; reescrito a mao (v60-v83). **v80 teve colisao (PDF×Portal)** e o branch do pipeline
> (v80-B…v83) **segue sem o `pdf.ts`** — merge manual a cada release (ver bloco acima). Repo AHEAD do completo de proposito;
> NAO reconciliar. 2 PNGs de lockup (e-mail) sao repo-only — preservar no clone/overlay.
