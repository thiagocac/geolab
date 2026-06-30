# INSTRUÇÕES — Patch v133 (cumulativo; inclui v132)

Patch **cumulativo** sobre o repositório (base v131). Inclui a v132 (numeração de CP manual) + v133
(toggles da ficha). Copiar por cima do source e dar push (GitHub → Netlify CI). **Supersede o patch v132.**

## Arquivos do patch
- `public/sw.js` · `src/lib/telemetry/core.ts`            — bump v133
- `src/lib/concreto/camposEnsaioLaudo.ts`                — v132: recebimento `numeracao_cp_manual`; v133: concretagem `ficha_contato_equipe` + `ficha_dosagem`
- `src/lib/concreto.ts`                                  — v132: helper bumpNumeracao()
- `src/lib/concreto.numeracao.test.ts`                   — v132: teste
- `src/lib/api/concretagem.ts`                           — v132: numeracao_lab por CP
- `src/pages/concreto/ConcretagemDetalhePage.tsx`       — v132: UI de numeração no modal
- `SOURCE_VERSION.md` · `docs/CHANGELOG-v132.md` · `docs/CHANGELOG-v133.md`

## Backend
- **EF `generate-ficha-moldagem-pdf` v21 (ezbr cb457923)** já publicada via MCP (logo dinâmica, sem Consulte GEO,
  print-friendly, coluna Numeração, gating por Config. de Campos, Número do relatório, dosagem do traço).
- Sem migration. Coluna `corpos_prova.numeracao_lab` já existia.

## Gate de build (espelho Netlify)
`npm run check:source` → `biome lint src` → `tsc --noEmit` → `vitest run` → `vite build`
- check-source + esbuild validados nesta sessão: OK. node_modules ausente → tsc/biome/vitest no CI.
