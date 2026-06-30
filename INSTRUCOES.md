# INSTRUÇÕES — Patch v131 (numeração lab toggle + label do filtro)

Patch **cumulativo** sobre o repositório (base v130). Copiar por cima do source e dar push (GitHub → Netlify CI).

## Arquivos do patch
- `public/sw.js` · `src/lib/telemetry/core.ts`        — bump v131
- `src/lib/concreto/camposEnsaioLaudo.ts`            — CAMPOS_ENSAIO += numeracao_lab (on)
- `src/pages/concreto/RompimentosPage.tsx`           — gate do "+ numeração lab" + label "Nota fiscal" -> "Buscar"
- `SOURCE_VERSION.md` · `docs/CHANGELOG-v131.md`

## Backend
- Sem mudança (só frontend).

## Gate de build (espelho Netlify)
`npm run check:source` -> `tsc --noEmit` -> `vitest run` -> `vite build`  · check-source + esbuild validados nesta sessão: OK
