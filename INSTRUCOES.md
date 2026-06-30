# INSTRUÇÕES — Patch v132 (numeração de CP manual na moldagem)

Patch **cumulativo** sobre o repositório (base v131). Copiar por cima do source e dar push (GitHub → Netlify CI).

## Arquivos do patch
- `public/sw.js` · `src/lib/telemetry/core.ts`              — bump v132 (CACHE_NAME + APP_VERSION juntos)
- `src/lib/concreto/camposEnsaioLaudo.ts`                  — CAMPOS_RECEBIMENTO += numeracao_cp_manual (off)
- `src/lib/concreto.ts`                                    — helper bumpNumeracao()
- `src/lib/concreto.numeracao.test.ts`                     — teste (12 casos)
- `src/lib/api/concretagem.ts`                             — addCaminhao grava numeracao_lab; CpDetalhe/select += numeracao_lab
- `src/pages/concreto/ConcretagemDetalhePage.tsx`         — bloco de numeração no modal + botão "Gerar numeração" + Nº nos cards
- `SOURCE_VERSION.md` · `docs/CHANGELOG-v132.md`

## Backend
- **Sem mudança.** A coluna `corpos_prova.numeracao_lab` já existe. Nenhuma migration, nenhuma EF.

## Gate de build (espelho Netlify)
`npm run check:source` → `biome lint src` → `tsc --noEmit` → `vitest run` → `vite build`
- check-source: OK · esbuild (transform) dos 5 arquivos alterados: OK · bumpNumeracao: 12/12 casos PASS nesta sessão.
- node_modules ausente no ambiente desta sessão → tsc/biome/vitest validados no CI do Netlify.
