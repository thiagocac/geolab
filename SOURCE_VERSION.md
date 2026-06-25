# GEOLAB → Concresoft — SOURCE VERSION v63
CACHE_NAME: consultegeo-geolab-v63 · APP_VERSION: v63
(slug interno `consultegeo-geolab` mantido; marca visivel = **Concresoft**; app em `app.concresoft.io`)

Frontend (acumulado v2→v63): …Portal do Cliente (v29) · Brand Kit (v30) · Estatistica de lote NBR 12655
(v39) · Motor de NC (v40-v44) · Financeiro (v49) · code-splitting (v50) · Biome (v51) · versao auto UI
(v52) · React 18→19 (v53) · React Compiler (v54) · rolldown-vite (v55) · Vite 8 + plugin-react v6 +
vitest 3 (v56) · Zod 4 (v57) · Observabilidade + Melhorias de processos (v58) · backend aplicado + tipos
reais + db tipado (v59) · Tailwind CSS v4 + tokens OKLCH (v60) · virada de paleta OKLCH (navy-tinted +
papel morno) + tipografia editorial + motion (v61) · View Transitions de rota (v62) · Base UI +
ConfirmDialog (v63). (historico completo v2→v49 em git log + 08-changelog.)

## v60→v63 — Fase 2/3: overhaul de design (sem mudanca de feature/backend)
- **v60** Migracao para **Tailwind CSS v4** (fundacao de tokens OKLCH). Config passa para `@theme` no CSS
  (PostCSS via `@tailwindcss/postcss`); **`tailwind.config.js` REMOVIDO** do repo (v4 nao usa).
- **v61** Virada de paleta para **OKLCH** (navy-tinted + papel morno) + **tipografia editorial** + **motion**
  (transicoes/animacoes). Identidade visual Concresoft preservada (navy/roxo/magenta + gradiente).
- **v62** **View Transitions de rota** (API nativa do browser), escopadas ao conteudo (nao pisca o shell).
- **v63** **Base UI** (primitivos acessiveis — Dialog/Popover/etc.) + **ConfirmDialog** substitui
  `window.confirm` (acessivel, on-brand). Fase 3 (1/n).
- Build verde: check-source · biome 0 · tsc 0 · vitest 18/18 · Vite 8.1 (Rolldown/Oxc) build.

## Backend / infra (estado vivo conforme GEOLAB-Project-Knowledge.md — FONTE CANONICA)
- Migrations **001-056** · 66 tabelas (100% RLS) · 11 views (security_invoker) · 165 policies · 49 funcoes.
- **27 EFs ACTIVE** (todas instrumentadas com `serveWithTelemetry`): laudo v12, ficha v10, telemetria
  (client-telemetry/telemetry-alarm), evidencias/aprovacao de laudo por magic link, etc.
- **13 crons ATIVOS** (pg_cron/pg_net). **E-mail real LIGADO** (`dispatch_enabled=true`, `dry_run=false`,
  allowlist `[thiago]` no piloto). Secrets: `CRON_SECRET` ✅, `RESEND_*` ✅; **conferir `VISION_API_KEY`** (EF secret).
- Stack: React 19.2 + Compiler · Vite 8.1 · vitest 3 · Biome 2.5 · Zod 4 · **Tailwind 4** · **Base UI**.

## Proximo: **v64 ainda nao gerado** (Fase 3 continua). Abrir a allowlist na virada do piloto;
reconciliar slot cron `concresoft-telemetria` (033) x `concresoft-telemetry-alarm` (ambos no minuto 0).
