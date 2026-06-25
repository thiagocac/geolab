# Patches v59 — Backend aplicado + tipos reais + db tipado (sobre v58)

## Frontend (sobe no GitHub -> Netlify)
- src/lib/database.types.ts  (REGENERADO do banco vivo — tipos reais)
- src/lib/api/concretagem.ts (db tipado + 3 casts localizados nos payloads dinamicos)
- src/lib/telemetry/core.ts  (APP_VERSION = 'v59') · public/sw.js (CACHE_NAME = v59)
Build validado: check-source · biome 0 · tsc 0 · vitest 18/18 · vite 8.1 (EXIT 0).

## Backend (JA APLICADO em producao via MCP — aqui so como referencia no source)
- supabase/migrations renomeadas 049-056 (era 048-055 no v58; colisao com o vivo 048_magic_links_portal).
  APAGUE no repo os arquivos antigos 048_*..055_* do release e use os 049-056 (cron com placeholders ja preenchidos).
- As 8 migrations FORAM aplicadas no banco vivo (xbdvyvvxvzmcosnekmfv). NAO reaplicar.

## Ainda pendente (voce)
1. Secrets (vault): CRON_SECRET, VISION_API_KEY, RESEND_FROM_EMAIL.
2. Deploy das 9 EFs restantes (inline self-contained; as 6 instrumentadas: partir do corpo VIVO via get_edge_function
   + adicionar serveWithTelemetry inline — NAO deployar a copia com import _shared, que nao bundla).
3. Reconciliar cron 'concresoft-telemetria' (slot 033) vs 'concresoft-telemetry-alarm'.
4. H3 notification_dispatch_settings p/ e-mail real.

Detalhe completo em GEOLAB-v58-Analise-e-Correcoes + SOURCE_VERSION.md.
Bump: APP_VERSION/CACHE_NAME = v59.
