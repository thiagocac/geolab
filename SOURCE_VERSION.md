# GEOLAB → Concresoft — SOURCE VERSION v76
CACHE_NAME: consultegeo-geolab-v76 · APP_VERSION: v76
(slug interno `consultegeo-geolab` mantido; marca visivel = **Concresoft**; app em `app.concresoft.io`)

Frontend (acumulado v2→v76): …Brand Kit (v30) · Motor de NC (v40-v44) · Financeiro (v49) ·
code-splitting (v50) · React 18→19 (v53) · React Compiler (v54) · rolldown-vite (v55) · Vite 8 +
vitest 3 (v56) · Zod 4 (v57) · Observabilidade (v58) · backend aplicado + tipos reais (v59) ·
Tailwind CSS v4 + OKLCH (v60) · tipografia editorial + motion (v61) · View Transitions (v62) ·
Base UI + ConfirmDialog (v63) · Cadastro em Drawer (v64) · Validacao RHF + Zod (v65) · Modal -> Base UI
Dialog a11y (v66) · "Nova programacao" pagina dedicada (v67) · Tooltip Base UI (v68) · ⌘K Command Palette
(v69) · paste-to-fill no grid de rompimentos (v70) · TanStack Table + Virtual (v71) · UX dos modais de
cadastro (v72, v76) · Recharts na Observabilidade (v73) · correcoes da auditoria v60→v73 (v74) · Cadastro
de "Tipos de ensaio" (catalogo material_test_types) (v75). (historico completo v2→v49 em git log + 08-changelog.)

## v60→v76 — Overhaul de design / UX por fases (sem mudanca de schema)
- **Fase 2 (v60-v62):** Tailwind v4 + tokens OKLCH · paleta navy-tinted + papel morno + tipografia
  editorial + motion · View Transitions de rota.
- **Fase 3 (v63-v68) — primitivos acessiveis (Base UI):** ConfirmDialog · Drawer de cadastro · RHF + Zod ·
  Modal -> Base UI Dialog a11y · "Nova programacao" pagina dedicada · Tooltip.
- **Fase 4 (v69-v72, v76) — produtividade / UX:** ⌘K Command Palette (v69) · paste-to-fill (v70) ·
  TanStack Table + Virtual (v71) · **UX dos modais de cadastro** — `Modal.tsx` cabecalho fixo + corpo
  rolavel + rodape fixo, alinhamento de campos (grid `auto-fit minmax`), scroll-into-view/foco nas 13 telas
  com `Modal`; preparada na **v72** e **re-aplicada na v76** sobre o v75 (espelha o `Drawer`).
- **Fase 5 (v73-…) — visualizacao de dados:** **Recharts** (charts) na Observabilidade (series temporais),
  com chunk `charts` isolado no Vite (recharts/d3/victory-vendor) (v73). Charts inlined em DashboardPage +
  ObservabilidadePage (sem `DashboardCharts.tsx` separado).
- **v74:** correcoes da auditoria v60→v73 (regressoes de UX/estado).
- **v75:** **Cadastro de "Tipos de ensaio"** — CRUD declarativo (AdminListPage) do catalogo
  `material_test_types` (**migration 006**, ja existente; sem migration nova e sem Edge Function; RLS
  is_tenant_writer; soft-delete). 1 arquivo: `CadastrosPage.tsx`.
- Build verde: check-source · biome 0 · tsc 0 · vitest · Vite 8.1 (Rolldown/Oxc) build. Nova dep: `recharts ^3.9`.

## E-mail transacional — Concresoft Email Kit (aplicado nesta sessao, fora do pipeline)
- Template "bulletproof" (header gradiente + lockup, kicker mono, botao MSO/VML, caixa de detalhes,
  rodape LGPD) aplicado nas EFs **`send-notification` (v10)** e **`enviar-laudo-cliente` (v5)**.
- Lockup PNG hospedado no app: `public/brand/concresoft-lockup-{white,color}-2x.png` →
  `app.concresoft.io/brand/…` (unicos arquivos do repo fora do `source-completo`; **preservar** nos releases).
- `APP_URL` fallback corrigido p/ `app.concresoft.io`. `approve-laudo-link` nao envia e-mail (inalterada).

## Backend / infra (estado vivo conforme GEOLAB-Project-Knowledge.md — FONTE CANONICA; v60-v76 nao mexem no schema)
- Migrations **001-056** · 66 tabelas (100% RLS). `material_test_types` (migration 006) consumido pelo CRUD da v75.
- **27 EFs ACTIVE** · **13 crons ATIVOS** · **e-mail real LIGADO** (`dispatch_enabled=true`, `dry_run=false`,
  **allowlist ABERTA = passa-tudo** — piloto aberto). Secrets `CRON_SECRET`/`RESEND_*`/`VISION_API_KEY` ✅.
- Stack: React 19.2 + Compiler · Vite 8.1 · vitest 3 · Biome 2.5 · Zod 4 · Tailwind 4 · Base UI · RHF ·
  TanStack Table + Virtual · **Recharts**.

## Proximo: continuar Fase 5 (visualizacao). Allowlist ja aberta (piloto).

> Nota: o `SOURCE_VERSION.md` do pipeline traz so as 2 ultimas releases + corpo antigo travado na v59; este
> foi reescrito a mao p/ refletir v60-v76. Os 2 PNGs de lockup em `public/brand` sao add manuais (e-mail) e
> NAO estao no `source-completo` — preservar no clone/overlay dos proximos releases.
