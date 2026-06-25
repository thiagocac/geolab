# GEOLAB → Concresoft — SOURCE VERSION v67
CACHE_NAME: consultegeo-geolab-v67 · APP_VERSION: v67
(slug interno `consultegeo-geolab` mantido; marca visivel = **Concresoft**; app em `app.concresoft.io`)

Frontend (acumulado v2→v67): …Brand Kit (v30) · Estatistica de lote NBR 12655 (v39) · Motor de NC
(v40-v44) · Financeiro (v49) · code-splitting (v50) · React 18→19 (v53) · React Compiler (v54) ·
rolldown-vite (v55) · Vite 8 + vitest 3 (v56) · Zod 4 (v57) · Observabilidade + Melhorias de processos
(v58) · backend aplicado + tipos reais (v59) · Tailwind CSS v4 + tokens OKLCH (v60) · virada de paleta
OKLCH navy-tinted + papel morno + tipografia editorial + motion (v61) · View Transitions de rota (v62) ·
Base UI + ConfirmDialog (v63) · Cadastro em Drawer lateral (v64) · Validacao React Hook Form + Zod no
cadastro (v65) · Modal central -> Base UI Dialog a11y (v66) · "Nova programacao" vira pagina dedicada
(v67). (historico completo v2→v49 em git log + 08-changelog.)

## v60→v67 — Fase 2/3: overhaul de design + UX (sem mudanca de backend)
- **v60** Tailwind CSS **v4** (tokens OKLCH; config via `@theme`; `tailwind.config.js` removido).
- **v61** paleta **OKLCH** (navy-tinted + papel morno) + tipografia editorial + motion.
- **v62** **View Transitions** de rota (nativas), escopadas ao conteudo.
- **v63** **Base UI** (primitivos acessiveis) + **ConfirmDialog** substitui `window.confirm`.
- **v64** **Cadastro em Drawer lateral** (padrao A).
- **v65** **Validacao com React Hook Form + Zod** no cadastro (schema -> form tipado + erros inline).
- **v66** **Modal central migrado para Base UI Dialog** (acessibilidade — foco/ESC/aria).
- **v67** **Padrao C:** "Nova programacao" deixa de ser modal e vira **pagina dedicada**.
- Build verde: check-source · biome 0 · tsc 0 · vitest 18/18 · Vite 8.1 (Rolldown/Oxc) build.

## Backend / infra (estado vivo conforme GEOLAB-Project-Knowledge.md — FONTE CANONICA; v60-v67 nao mexem)
- Migrations **001-056** · 66 tabelas (100% RLS) · 11 views · 165 policies · 49 funcoes.
- **27 EFs ACTIVE** (todas com `serveWithTelemetry`) · **13 crons ATIVOS** · **e-mail real LIGADO**
  (`dispatch_enabled=true`, `dry_run=false`, allowlist `[thiago]`). Secrets `CRON_SECRET`/`RESEND_*` ✅.
- Stack: React 19.2 + Compiler · Vite 8.1 · vitest 3 · Biome 2.5 · Zod 4 · Tailwind 4 · Base UI · React Hook Form.

## Proximo: continuar a Fase 3 (proximas versoes). Abrir a allowlist na virada do piloto.

> Nota: o `SOURCE_VERSION.md` do pipeline vem com o título bumpado mas o corpo travado na v59 (stale);
> este foi reescrito a mao para refletir v60-v67.
