# GEOLAB → Concresoft — SOURCE VERSION v80
CACHE_NAME: consultegeo-geolab-v80 · APP_VERSION: v80
(slug interno `consultegeo-geolab` mantido; marca visivel = **Concresoft**; app em `app.concresoft.io`)

Frontend (acumulado v2→v80): …Brand Kit (v30) · Motor de NC (v40-v44) · Financeiro (v49) ·
code-splitting (v50) · React 18→19 (v53) · React Compiler (v54) · rolldown-vite (v55) · Vite 8 +
vitest 3 (v56) · Zod 4 (v57) · Observabilidade (v58) · backend aplicado + tipos reais (v59) ·
Tailwind CSS v4 + OKLCH (v60) · tipografia editorial + motion (v61) · View Transitions (v62) ·
Base UI + ConfirmDialog (v63) · Cadastro em Drawer (v64) · Validacao RHF + Zod (v65) · Modal -> Base UI
Dialog a11y (v66) · "Nova programacao" dedicada (v67) · Tooltip (v68) · ⌘K Command Palette (v69) ·
paste-to-fill (v70) · TanStack Table + Virtual (v71) · UX dos modais de cadastro (v72, v76) · Recharts na
Observabilidade (v73) · correcoes auditoria v60→v73 (v74) · "Tipos de ensaio" (v75) · Reconciliacao
modernizacao+dominio (v77) · icones do menu lateral (v78) · SPA fallback no Netlify — fix 404 ao recarregar
(v79) · revisao da emissao/abertura de PDFs (v80). (historico v2→v49 em git log.)

## v60→v80 — Overhaul de design / UX + robustez (sem mudanca de schema feita por mim)
- **Fase 2 (v60-v62):** Tailwind v4 + tokens OKLCH · paleta navy + papel morno + tipografia editorial + motion · View Transitions.
- **Fase 3 (v63-v68) — Base UI:** ConfirmDialog · Drawer de cadastro · RHF + Zod · Modal a11y · "Nova programacao" · Tooltip.
- **Fase 4 (v69-v72, v76) — produtividade/UX:** ⌘K Command Palette · paste-to-fill · TanStack Table + Virtual ·
  UX dos modais de cadastro — scroll/alinhamento/foco (preparada na v72, re-aplicada na v76).
- **Fase 5 (v73-…) — visualizacao:** Recharts na Observabilidade (chunk `charts`); `DashboardCharts.tsx` consumido por `DashboardPage`.
- **v74:** correcoes auditoria v60→v73. **v75:** CRUD de "Tipos de ensaio" (`material_test_types`, migration 006).
- **v77 — Reconciliacao (pipeline):** alinha modernizacao v60→v74 + "modais v72" + dominio v52 (`lab.consultegeo.org` -> `app.concresoft.io`).
- **v78 — Icones do menu lateral:** novos SVG em `icons.tsx` + mapeamento em `Layout.tsx`.
- **v79 — SPA fallback (Netlify):** adiciona `public/_redirects` (`/* /index.html 200`) — corrige o **404 ao recarregar/abrir deep-link** numa rota do app (SPA). So infra de roteamento.
- **v80 — Robustez de emissao/abertura de PDFs (so front):** util novo `src/lib/pdf.ts` (`saveBlob`/`saveUrl`/
  `blobUrlAutoRevoke`/`openDeferredTab`) + refator de TODOS os pontos que abrem/baixam PDF. Corrige popup-blocker do
  `window.open` pos-`await` (abre a aba sincrona no clique, navega depois), nome de arquivo correto e revogacao ADIADA
  do objectURL (revogar cedo abortava o download). Pontos: laudo, medicao, anexo de NC, portal do cliente, ficha/agenda,
  exportacoes XLSX. **Depende da migration 062 (policy de storage `lab_laudos_read`, ja LIVE)** — ver Backend.
- Build verde: check-source · biome 0 · tsc 0 · vitest · Vite 8.1 (Rolldown/Oxc). Deps: base-ui/rhf/tanstack/recharts.

## E-mail transacional — Concresoft Email Kit (aplicado nesta sessao, fora do pipeline)
- Template "bulletproof" (header gradiente + lockup PNG de `app.concresoft.io/brand/`, kicker mono, botao MSO/VML,
  caixa de detalhes, rodape LGPD) nos 2 unicos senders Resend: **`send-notification` v10** (hub) e
  **`enviar-laudo-cliente` v5** (laudo PDF anexado).
- Lockup PNG `public/brand/concresoft-lockup-{white,color}-2x.png` — repo-only, NAO vem no source-completo; **preservar**.
- Auditoria das 27 EFs: cobertura TOTAL — digests/alarme/watchdog/notify-event delegam ao hub. **`telemetry-alarm` v4
  corrigida** (contrato do hub) + **e-mail de alertas LIGADO** (`telemetry_settings.alert_notify_email=true`).
  Detalhes na memoria geolab-email-architecture.

## Backend / infra (estado vivo; FONTE CANONICA = GEOLAB-Project-Knowledge.md; v60-v80 nao mexem no schema por mim)
- **Migrations: 62 aplicadas** (era 001-056 no meu tracking; 057-062 aplicadas em prod fora desta sessao). A **062 =
  policy de storage `lab_laudos_read`** no bucket `lab-reports` (libera o download do laudo p/ staff — dependencia da v80, CONFIRMADA LIVE).
- 66 tabelas (100% RLS). **27 EFs ACTIVE** · **13 crons ATIVOS**.
- **E-mail real LIGADO**: `dispatch_enabled=true`, `dry_run=false`, **allowlist ABERTA** (passa-tudo). Secrets `CRON_SECRET`/`RESEND_*`/`VISION_API_KEY` ✅.
- **E-mail de alertas de telemetria LIGADO**: `telemetry_settings.alert_notify_email=true` (so alerta critico NOVO; hoje so thiago@consultegeo.com.br).
- Stack: React 19.2 + Compiler · Vite 8.1 · vitest 3 · Biome 2.5 · Zod 4 · Tailwind 4 · Base UI · RHF · TanStack Table + Virtual · Recharts.

## Proximo: continuar Fase 5 (visualizacao). Piloto aberto (allowlist + alertas por e-mail ligados).

> Nota: o SOURCE_VERSION do pipeline traz so as ultimas releases + corpo antigo (v59); este foi reescrito a mao p/ refletir
> v60-v80. v79/v80 SOMARAM limpo ao source-completo (sem reconciliacao); v72-v78 nao somavam (dep recharts, DashboardCharts.tsx)
> e foram reconciliados a mao. Os 2 PNGs de lockup sao add manuais (e-mail) e NAO estao no source-completo — preservar.
