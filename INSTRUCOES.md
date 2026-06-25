# Patches v58 — Observabilidade + Melhorias (combinado sobre v57)

Pacote source da v58: v57 modernizado + as duas frentes do release, ja reconciliado e BUILDANDO VERDE.

## Como aplicar
1. FRONTEND (Netlify, via GitHub): sobrepor todos os arquivos de `src/` e `public/sw.js`. O App.tsx/ficha
   ja vem combinados; o database.types.ts traz stubs das tabelas novas (regerar depois — ver abaixo).
2. BACKEND (via MCP, fora do Netlify): aplicar migrations 048->055 (uma por vez, list_migrations entre cada),
   deploy das EFs usando o supabase/config.toml incluido. Detalhe e ordem completa em:
   - docs/v58-RELEASE-README.md  (ordem combinada + ressalvas)
   - docs/v58-observabilidade.md (camadas, crons, secrets)
   - docs/v58-melhorias.md       (9 melhorias, EFs, G1/H3)
3. REGENERAR database.types.ts apos aplicar as migrations (substitui os 7 stubs por tipos reais):
   `npm run gen:types` (ou MCP generate_typescript_types no projeto xbdvyvvxvzmcosnekmfv).
4. Secrets/config: CRON_SECRET; G1 (VISION_API_KEY, RESEND_FROM_EMAIL); H3 (notification_dispatch_settings).

## Validacao ja executada (sandbox) — gate completo
- npm run build => check-source OK · biome 0 erros · tsc 0 erros · vitest 18/18 · vite 8.1 build OK · EXIT 0.

## Observacoes importantes
- database.types.ts: os 7 stubs SAO PROVISORIOS (o build so fica honesto-tipado apos o gen:types real).
- concretagem.ts usa `db` cast para untyped (escolha do release p/ evidencias) — funciona; recomendo re-tipar.
- EFs e migrations passam no check-source mas NAO foram executadas em runtime (sem Deno/banco no sandbox).

Bump: APP_VERSION/CACHE_NAME = v58.
