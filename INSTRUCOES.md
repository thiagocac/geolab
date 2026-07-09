# GEOLAB — v207 — instruções de aplicação

**Saúde operacional — p95 do `notify-event`.** Backend (EF) já deployado via MCP; este zip carrega o **espelho** (commit obrigatório senão o push reverte) + o bump.

## Backend — JÁ DEPLOYADO (MCP)
- **EF `notify-event` v50** (sha `9e91da70…`, era `35f50b16…`; `verify_jwt=false` preservado): o fan-out para `send-notification` deixou de ser **sequencial** (`for...await`, somava ~0,5–1,5s por destinatário → p95 ~8,3s) e passou a **paralelo em lotes de 12** (`Promise.all`, com `try/catch` por envio). p95 esperado ≈ 1 round-trip do `send-notification` (~1,5s). Semântica preservada (mesmos resultados por destinatário, outbox marcado `processed` ao fim).
- **Espelho** `supabase/functions/notify-event/index.ts` atualizado — precisa ir pro Git para o próximo push não reverter o deploy.

## Bounce de e-mail 12,5% — DIAGNOSTICADO, sem ação de código
- Era **pico histórico de endereços de teste** (`obras@isa.example.com` — domínio reservado, bounce sempre; `demo@concresoft.com.br`) já **suprimidos** (`email_suppressions`; 15 `suppressed` no período). Nenhum member usa `.example.com`.
- O alarme **não está mais ativo**: janela 24h atual = 5 envios / 0 bounces, e o piso `alert_email_min_sent=20` já barra ruído de baixo volume. Auto-resolvente; não mexi no limiar (seria mascarar).

## Arquivos (patches)
- supabase/functions/notify-event/index.ts (espelho paralelizado)
- src/lib/telemetry/core.ts (APP_VERSION v207)
- public/sw.js (CACHE_NAME v207)

## Gate
check-source OK · biome 0 · vitest 23/23 · esbuild da EF OK. Frontend sem mudança de código (só bump). `vite`/`tsc` no Netlify.
