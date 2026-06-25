# GEOLAB → Concresoft — SOURCE VERSION v81
CACHE_NAME: consultegeo-geolab-v81 · APP_VERSION: v81
(slug interno `consultegeo-geolab` mantido; marca visivel = **Concresoft**; app em `app.concresoft.io`)

Frontend (acumulado v2→v81): …Brand Kit (v30) · Motor de NC (v40-v44) · Financeiro (v49) ·
code-splitting (v50) · React 18→19 (v53) · React Compiler (v54) · rolldown-vite (v55) · Vite 8 +
vitest 3 (v56) · Zod 4 (v57) · Observabilidade (v58) · backend aplicado + tipos reais (v59) ·
Tailwind CSS v4 + OKLCH (v60) · tipografia editorial + motion (v61) · View Transitions (v62) ·
Base UI + ConfirmDialog (v63) · Cadastro em Drawer (v64) · Validacao RHF + Zod (v65) · Modal -> Base UI
Dialog a11y (v66) · "Nova programacao" dedicada (v67) · Tooltip (v68) · ⌘K Command Palette (v69) ·
paste-to-fill (v70) · TanStack Table + Virtual (v71) · UX dos modais de cadastro (v72, v76) · Recharts na
Observabilidade (v73) · correcoes auditoria v60→v73 (v74) · "Tipos de ensaio" (v75) · Reconciliacao
modernizacao+dominio (v77) · icones do menu lateral (v78) · SPA fallback (v79) · revisao da emissao/abertura
de PDFs (v80-A) · Portal do cliente — abas/Parcial-Final/resultados/Excel (v80-B) · 12 melhorias do portal (v81).
(historico v2→v49 em git log.)

## ⚠️ DUAS v80 — colisao de numeracao resolvida por MERGE (ler antes de mexer)
O pipeline gerou DOIS releases diferentes rotulados "v80":
- **v80-A "Revisao de PDFs"** (commit `dc244ff`, JA estava NO AR): util `src/lib/pdf.ts` + fix de popup-blocker.
- **v80-B "Portal do cliente"** (zip regerado depois, **a partir da v79, SEM o `pdf.ts`**): abas Programacao/Resultados,
  Parcial/Final, resultados inline, export Excel.
- **v81** ("12 melhorias do portal") tambem foi gerado **sem** a revisao de PDF.

Decisao (Thiago): **manter as duas** (MERGE) e numerar como **2a v80 + v81** (CACHE_NAME v80 nos commits A e B; v81 = bump).
- **MERGE manual de 3 arquivos** que os dois fluxos tocam — `src/lib/api/laudo.ts`, `src/pages/concreto/LaudosPage.tsx`,
  `src/pages/portal/ClientePortalPage.tsx`: re-aplicado o padrao da revisao de PDF (`openDeferredTab`/`saveUrl`/
  `blobUrlAutoRevoke`, `downloadUrl(path, filename)`) sobre as versoes do Portal. `pdf.ts` + os outros 9 arquivos da
  revisao de PDF foram preservados intactos. (Na v81 a nova `baixarAnexo` do portal tambem ganhou `openDeferredTab`.)
- **Os completos v80-B/v81 do pipeline NAO tem a revisao de PDF** — **NAO reconciliar com eles** (reverteria o `pdf.ts`).
  O `diff -rq` vs completo mostra DE PROPOSITO ~11 arquivos de PDF + `pdf.ts` divergentes; isso e o esperado aqui.

## v60→v81 — Overhaul de design / UX + robustez + portal do cliente
- **Fase 2 (v60-v62):** Tailwind v4 + OKLCH · paleta navy + tipografia editorial + motion · View Transitions.
- **Fase 3 (v63-v68) — Base UI:** ConfirmDialog · Drawer · RHF + Zod · Modal a11y · "Nova programacao" · Tooltip.
- **Fase 4 (v69-v72, v76):** ⌘K Command Palette · paste-to-fill · TanStack Table + Virtual · UX dos modais de cadastro.
- **Fase 5 (v73-…):** Recharts na Observabilidade (chunk `charts`); `DashboardCharts.tsx`.
- **v74:** correcoes auditoria. **v75:** CRUD "Tipos de ensaio". **v77:** reconciliacao pipeline. **v78:** icones do menu.
- **v79 — SPA fallback (Netlify):** `public/_redirects` (`/* /index.html 200`) — fix do 404 ao recarregar/deep-link.
- **v80-A — Robustez de PDFs (so front):** util `src/lib/pdf.ts` + refator de TODOS os pontos que abrem/baixam PDF
  (popup-blocker pos-`await`, nome de arquivo, revogacao adiada do objectURL). Depende da migration 062 (`lab_laudos_read`, LIVE).
- **v80-B — Portal do cliente:** `ClientePortalPage` em abas (Programacao / Resultados & Laudos) · **Parcial/Final**
  (`ParcialFinalBadge`) · resultados inline (`LaudosResultadosPanel`) · export Excel · "Acesso por link sem senha"
  (`criarLinkPortal`) · rota publica `/portal/acesso/:token`. Migration **063** + EF `lab-client-portal` v8 ja LIVE.
- **v81 — 12 melhorias do portal:** evolucao de exemplares (`EvolucaoExemplares`), anexos do cliente (upload/download),
  classificacao de laudos (`listLaudosClassificacao`), `portalCliente.ts`, refinos de UX. Migration **064** ja LIVE.
- Build verde: check-source · biome 0 · tsc 0 · vitest · Vite 8.1 (Rolldown/Oxc). Deps: base-ui/rhf/tanstack/recharts.

## E-mail transacional — Concresoft Email Kit (fora do pipeline)
- Template "bulletproof" nos 2 unicos senders Resend: **`send-notification` v10** (hub) e **`enviar-laudo-cliente` v5**
  (laudo PDF anexado). Lockup PNG `public/brand/concresoft-lockup-{white,color}-2x.png` — **repo-only, preservar**.
- 27 EFs auditadas: cobertura TOTAL (digests/alarme/watchdog/notify-event delegam ao hub). `telemetry-alarm` v4 corrigida;
  e-mail de alertas LIGADO. **REGRA FIXA: e-mail novo usa o Kit** (PK §3). Detalhes na memoria geolab-email-architecture.

## Backend / infra (estado vivo; FONTE CANONICA = GEOLAB-Project-Knowledge.md)
- **Migrations: 64 aplicadas** (todas LIVE). Portal: **062** `lab_laudos_read` (v80-A) · **063** `portal_resultados_parcial_final`
  (v80-B) · **064** `portal_melhorias_classificacao_magiclink` (v81). 66 tabelas (100% RLS). **27 EFs ACTIVE** · **13 crons**.
- **E-mail real LIGADO**: `dispatch_enabled=true`, `dry_run=false`, **allowlist ABERTA**. `telemetry_settings.alert_notify_email=true`.
  Secrets `CRON_SECRET`/`RESEND_*`/`VISION_API_KEY` ✅.
- Stack: React 19.2 + Compiler · Vite 8.1 · vitest 3 · Biome 2.5 · Zod 4 · Tailwind 4 · Base UI · RHF · TanStack Table + Virtual · Recharts.

## Proximo: continuar portal do cliente / Fase 5. Piloto aberto.

> Nota: SOURCE_VERSION do pipeline vem stale; este e reescrito a mao (v60-v81). **v80 teve colisao (PDF×Portal)** resolvida
> por merge — ver bloco "DUAS v80" acima. Os completos v80-B/v81 do pipeline omitem a revisao de PDF; o repo esta AHEAD por
> ela de proposito (nao reconciliar). 2 PNGs de lockup (e-mail) sao repo-only — preservar no clone/overlay.
