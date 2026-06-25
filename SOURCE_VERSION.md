# GEOLAB → Concresoft — SOURCE VERSION v71
CACHE_NAME: consultegeo-geolab-v71 · APP_VERSION: v71
(slug interno `consultegeo-geolab` mantido; marca visivel = **Concresoft**; app em `app.concresoft.io`)

Frontend (acumulado v2→v71): …Brand Kit (v30) · Motor de NC (v40-v44) · Financeiro (v49) ·
code-splitting (v50) · React 18→19 (v53) · React Compiler (v54) · rolldown-vite (v55) · Vite 8 +
vitest 3 (v56) · Zod 4 (v57) · Observabilidade + Melhorias de processos (v58) · backend aplicado +
tipos reais (v59) · Tailwind CSS v4 + OKLCH (v60) · paleta OKLCH + tipografia editorial + motion (v61) ·
View Transitions (v62) · Base UI + ConfirmDialog (v63) · Cadastro em Drawer (v64) · Validacao RHF + Zod
(v65) · Modal -> Base UI Dialog a11y (v66) · "Nova programacao" pagina dedicada (v67) · Tooltip Base UI
(v68) · ⌘K Command Palette (v69) · paste-to-fill no grid de rompimentos (v70) · TanStack Table + Virtual
grid virtualizado (v71). (historico completo v2→v49 em git log + 08-changelog.)

## v60→v71 — Overhaul de design / UX por fases (sem mudanca de backend)
- **Fase 2 (v60-v62):** Tailwind v4 + tokens OKLCH (`tailwind.config.js` removido) · paleta OKLCH
  navy-tinted + papel morno + tipografia editorial + motion · View Transitions de rota.
- **Fase 3 (v63-v68) — primitivos acessiveis (Base UI):** ConfirmDialog (v63) · Drawer de cadastro (v64) ·
  RHF + Zod (v65) · Modal -> Base UI Dialog a11y (v66) · "Nova programacao" pagina dedicada (v67) · Tooltip (v68).
- **Fase 4 (v69-…) — produtividade:** **⌘K Command Palette** (v69) · **paste-to-fill** (edicao em massa
  colando) no grid de rompimentos (v70) · **TanStack Table + Virtual** — grid virtualizado e ordenavel
  (isolado) (v71).
- Build verde: check-source · biome 0 · tsc 0 · vitest 18/18 · Vite 8.1 (Rolldown/Oxc) build.

## Backend / infra (estado vivo conforme GEOLAB-Project-Knowledge.md — FONTE CANONICA; v60-v71 nao mexem)
- Migrations **001-056** · 66 tabelas (100% RLS) · 11 views · 165 policies · 49 funcoes.
- **27 EFs ACTIVE** (todas com `serveWithTelemetry`) · **13 crons ATIVOS** · **e-mail real LIGADO**
  (`dispatch_enabled=true`, `dry_run=false`, allowlist `[thiago]`). Secrets `CRON_SECRET`/`RESEND_*` ✅.
- Stack: React 19.2 + Compiler · Vite 8.1 · vitest 3 · Biome 2.5 · Zod 4 · Tailwind 4 · Base UI · React
  Hook Form · **TanStack Table + Virtual**.

## Proximo: continuar a Fase 4 (produtividade). Abrir a allowlist na virada do piloto.

> Nota: o `SOURCE_VERSION.md` do pipeline vem com o título bumpado mas o corpo travado na v59 (stale);
> este foi reescrito a mao para refletir v60-v71.
