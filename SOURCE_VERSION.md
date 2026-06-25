# GEOLAB → Concresoft — SOURCE VERSION v69
CACHE_NAME: consultegeo-geolab-v69 · APP_VERSION: v69
(slug interno `consultegeo-geolab` mantido; marca visivel = **Concresoft**; app em `app.concresoft.io`)

Frontend (acumulado v2→v69): …Brand Kit (v30) · Motor de NC (v40-v44) · Financeiro (v49) ·
code-splitting (v50) · React 18→19 (v53) · React Compiler (v54) · rolldown-vite (v55) · Vite 8 +
vitest 3 (v56) · Zod 4 (v57) · Observabilidade + Melhorias de processos (v58) · backend aplicado +
tipos reais (v59) · Tailwind CSS v4 + tokens OKLCH (v60) · virada de paleta OKLCH navy-tinted + papel
morno + tipografia editorial + motion (v61) · View Transitions de rota (v62) · Base UI + ConfirmDialog
(v63) · Cadastro em Drawer lateral (v64) · Validacao RHF + Zod no cadastro (v65) · Modal central ->
Base UI Dialog a11y (v66) · "Nova programacao" vira pagina dedicada (v67) · Tooltip Base UI nos botoes
de icone (v68) · ⌘K Command Palette (v69). (historico completo v2→v49 em git log + 08-changelog.)

## v60→v69 — Overhaul de design / UX por fases (sem mudanca de backend)
- **Fase 2 (v60-v62):** Tailwind CSS **v4** (tokens OKLCH; `tailwind.config.js` removido) · virada de
  paleta **OKLCH** (navy-tinted + papel morno) + tipografia editorial + motion · **View Transitions** de rota.
- **Fase 3 (v63-v68) — primitivos acessiveis (Base UI):** ConfirmDialog substitui `window.confirm` (v63) ·
  Cadastro em **Drawer lateral** (v64) · validacao **React Hook Form + Zod** no cadastro (v65) · Modal
  central -> **Base UI Dialog** a11y (v66) · "Nova programacao" vira **pagina dedicada** (v67) · **Tooltip**
  do Base UI nos botoes de icone (v68 — fecha a Fase 3, 6/6).
- **Fase 4 (v69-…) — produtividade:** **⌘K Command Palette** (busca/acoes rapidas) inicia a fase (1/n).
- Build verde: check-source · biome 0 · tsc 0 · vitest 18/18 · Vite 8.1 (Rolldown/Oxc) build.

## Backend / infra (estado vivo conforme GEOLAB-Project-Knowledge.md — FONTE CANONICA; v60-v69 nao mexem)
- Migrations **001-056** · 66 tabelas (100% RLS) · 11 views · 165 policies · 49 funcoes.
- **27 EFs ACTIVE** (todas com `serveWithTelemetry`) · **13 crons ATIVOS** · **e-mail real LIGADO**
  (`dispatch_enabled=true`, `dry_run=false`, allowlist `[thiago]`). Secrets `CRON_SECRET`/`RESEND_*` ✅.
- Stack: React 19.2 + Compiler · Vite 8.1 · vitest 3 · Biome 2.5 · Zod 4 · Tailwind 4 · Base UI · React Hook Form.

## Proximo: continuar a Fase 4 (produtividade). Abrir a allowlist na virada do piloto.

> Nota: o `SOURCE_VERSION.md` do pipeline vem com o título bumpado mas o corpo travado na v59 (stale);
> este foi reescrito a mao para refletir v60-v69.
