# INSTRUÇÕES — Patch v128 (Gestão de usuários robusta + matriz de permissões)

Patch **cumulativo** sobre o repositório (base v127). Copiar por cima do source e dar push (GitHub → Netlify CI).

## Arquivos do patch (frontend)
- `public/sw.js` · `src/lib/telemetry/core.ts`        — bump v128
- `src/lib/auth.tsx`                                   — `can()` + permissões efetivas
- `src/lib/api/rbac.ts`                                — catálogo de permissões + papéis (CRUD)
- `src/lib/api/operacao.ts`                            — membros enriquecidos, escopo, overrides
- `src/pages/operacao/OperacaoPage.tsx`               — gestão de usuários reformada
- `src/pages/gestao/RbacPage.tsx`                      — matriz agrupada + papéis custom
- `src/pages/concreto/LaudosPage.tsx`                 — emitir/aprovar via `can('laudo.aprovar')`
- `SOURCE_VERSION.md` · `docs/CHANGELOG-v128.md`

## Backend (sem ação no push)
- Migrations **109** e **110** — **já aplicadas via MCP** em `xbdvyvvxvzmcosnekmfv`. Referências em `docs/109_*.sql` e `docs/110_*.sql`.

## Gate de build (espelho Netlify)
`npm run check:source` → `tsc --noEmit` → `vitest run` → `vite build`  · check-source + esbuild validados nesta sessão: OK
