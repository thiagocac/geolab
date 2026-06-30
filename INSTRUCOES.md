# INSTRUÇÕES — Patch v127 (Escopo de construtora para traços)

Patch **cumulativo** sobre o repositório (base v126). Copiar os arquivos por cima do source e dar push (GitHub → Netlify CI).

## Arquivos do patch (frontend)
- `public/sw.js` · `src/lib/telemetry/core.ts`         — bump v127
- `src/components/TracoOptions.tsx`                     — NOVO (dropdown agrupado por origem)
- `src/lib/api/concretagem.ts`                          — listTracosComFck(workId, clientId) com cadeia de escopo
- `src/lib/api/obras.ts`                                — createTracoObra deriva client_id da obra
- `src/lib/api/materiais.ts`                            — TracoRow/SELECT/saveTraco com escopo
- `src/pages/concreto/NovaProgramacaoPage.tsx`         — dropdown escopado + agrupado
- `src/pages/concreto/ConcretagensPage.tsx`            — idem
- `src/pages/concreto/ConcretagemDetalhePage.tsx`      — idem
- `src/pages/cadastros/MateriaisPage.tsx`              — picker de escopo + filtro + badge + Duplicar
- `SOURCE_VERSION.md` · `docs/CHANGELOG-v127.md`

## Backend (sem ação no push)
- Migration **108_operational_materials_client_scope** — **já aplicada via MCP** em `xbdvyvvxvzmcosnekmfv`
  (coluna `client_id` + backfill + índice). SQL de referência em `docs/108_*.sql`.

## Gate de build (espelho Netlify)
`npm run check:source` → `tsc --noEmit` → `vitest run` → `vite build`  · check-source + esbuild validados nesta sessão: OK
