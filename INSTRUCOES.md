# INSTRUÇÕES — Patch v130 (FIX crítico do RBAC: erro "reading 'rest'")

Patch **cumulativo** sobre o repositório (base v129). Copiar por cima do source e dar push (GitHub → Netlify CI).

## Arquivos do patch
- `public/sw.js` · `src/lib/telemetry/core.ts`   — bump v130
- `src/lib/api/rbac.ts`                          — bind do client (matriz/papéis)
- `src/lib/api/operacao.ts`                      — bind (lista de usuários, RPCs de gestão)
- `src/lib/auth.tsx`                             — bind (current_member_permissions / can())
- `src/lib/api/docgate.ts`                       — bind (Documentos e gate)
- `src/lib/api/timeline.ts`                      — bind (Linha do tempo)
- `SOURCE_VERSION.md` · `docs/CHANGELOG-v130.md`

## Backend
- Sem mudança (só frontend). Migrations/EFs inalteradas.

## Gate de build (espelho Netlify)
`npm run check:source` → `tsc --noEmit` → `vitest run` → `vite build`  · check-source + esbuild validados nesta sessão: OK
