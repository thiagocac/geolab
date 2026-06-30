# INSTRUÇÕES — Patch v129 (RBAC Fase 2)

Patch **cumulativo** sobre o repositório (base v128). Copiar por cima do source e dar push (GitHub → Netlify CI).

## Frontend
- `public/sw.js` · `src/lib/telemetry/core.ts`         — bump v129
- `src/lib/api/operacao.ts`                            — resetPassword + getMemberEffectivePermissions
- `src/pages/operacao/OperacaoPage.tsx`               — ficha: Redefinir senha + Permissões efetivas
- `src/pages/gestao/MedicaoPage.tsx` · `FaturasPage.tsx` · `ConfigCamposPage.tsx` · `NcConfigPage.tsx` — gates via can()
- `src/pages/concreto/LotesPage.tsx` · `NcPage.tsx`   — gates via can()
- `SOURCE_VERSION.md` · `docs/CHANGELOG-v129.md`

## Backend (já aplicado via MCP — sem ação no push)
- Migration **111** aplicada. EFs **admin-create-lab v8** e **admin-reset-password v1** deployadas.
  Cópias de referência em `supabase/functions/admin-create-lab/index.ts` e `.../admin-reset-password/index.ts`.

## Gate de build (espelho Netlify)
`npm run check:source` → `tsc --noEmit` → `vitest run` → `vite build`  · check-source + esbuild validados nesta sessão: OK
